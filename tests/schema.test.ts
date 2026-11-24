import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const integration = describe.skipIf(!testDatabaseUrl);

const documentedTypes: Record<string, string> = {
  TEXT: 'text',
  TIMESTAMPTZ: 'timestamp with time zone',
  BIGINT: 'bigint',
  INTEGER: 'integer',
  DATE: 'date',
  BOOLEAN: 'boolean',
  JSONB: 'jsonb',
};

type DocumentedColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  singlePrimaryKey: boolean;
  compositePrimaryKey: string[] | null;
  foreignKey: { table: string; column: string } | null;
  unique: boolean;
  uniqueWith: string | null;
  enumValues: string[];
  expressionChecks: string[];
};

type DocumentedIndex = {
  name: string;
  columns: string[];
};

type DocumentedTable = {
  name: string;
  columns: DocumentedColumn[];
  indexes: DocumentedIndex[];
  allNullCheckColumns: string[];
};

type DocumentedSchema = Map<string, DocumentedTable>;

type ActualColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
};

type ActualIndex = {
  name: string;
  columns: string[];
  constraintBacked: boolean;
};

type ActualTable = {
  columns: ActualColumn[];
  primaryKey: string[];
  indexes: ActualIndex[];
  foreignKeys: { column: string; table: string; refColumn: string }[];
  uniqueConstraints: { name: string; columns: string[] }[];
  checks: { name: string; definition: string }[];
};

type ActualSchema = Map<string, ActualTable>;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function stripIndexOrder(column: string): string {
  return column
    .trim()
    .replace(/\s+(?:ASC|DESC)$/i, '')
    .replace(/^"(.*)"$/, '$1');
}

function normalizeDocumentedDefault(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "''") return "''::text";
  return normalized;
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
  return cells.length >= 3 ? cells : null;
}

function parseColumn(name: string, type: string, constraints: string): DocumentedColumn {
  const compositePrimaryKey = constraints.match(/Part of composite primary key `\(([^)]+)\)`/i);
  const isCompositePart = /Part of composite primary key/i.test(constraints);
  const hasPrimaryKey = /\bPrimary key\b/i.test(constraints);
  const defaultMatch = constraints.match(/DEFAULT\s+([^`\s]+)/i);
  const enumMatch = constraints.match(/check in\s+(.+)$/i);
  const foreignKey = constraints.match(/foreign key to `([a-z_]+)\.([a-z_]+)`/i);
  const uniqueWith = constraints.match(/unique with `([a-z_]+)`/i);

  return {
    name,
    type,
    nullable:
      !/\bNOT NULL\b/i.test(constraints) && !hasPrimaryKey && /\bNullable\b/i.test(constraints),
    defaultValue: defaultMatch ? normalizeDocumentedDefault(defaultMatch[1]) : null,
    singlePrimaryKey: hasPrimaryKey && !isCompositePart,
    compositePrimaryKey: compositePrimaryKey
      ? compositePrimaryKey[1].split(',').map((column) => column.trim())
      : null,
    foreignKey: foreignKey ? { table: foreignKey[1], column: foreignKey[2] } : null,
    unique: !uniqueWith && /UNIQUE(?!\s+with)/i.test(constraints),
    uniqueWith: uniqueWith ? uniqueWith[1] : null,
    enumValues: enumMatch ? [...enumMatch[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]) : [],
    expressionChecks: [...constraints.matchAll(/CHECK \(([^)]+)\)/g)].map((match) =>
      match[1].trim(),
    ),
  };
}

function parseDocumentedIndexes(section: string): DocumentedIndex[] {
  return [...section.matchAll(/`([a-z][a-z0-9_]*_idx)\(([^)]*)\)/g)].map((match) => ({
    name: match[1],
    columns: match[2]
      .split(',')
      .map(stripIndexOrder)
      .filter((column) => column.length > 0),
  }));
}

function parseAllNullCheckColumns(section: string): string[] {
  const sentence = section.split('\n').find((line) => /all NULL or all populated/i.test(line));
  if (!sentence) return [];
  return [...sentence.matchAll(/`([a-z_]+)`/g)].map((match) => match[1]);
}

async function readDocumentedSchema(): Promise<DocumentedSchema> {
  const markdown = await readFile(new URL('../docs/backend-design.md', import.meta.url), 'utf8');
  const start = markdown.indexOf('## Data Model');
  const end = markdown.indexOf('## API Routes');
  if (start < 0 || end <= start) {
    throw new Error('Could not find the Data Model section in docs/backend-design.md.');
  }

  const dataModel = markdown.slice(start, end);
  const headings = [...dataModel.matchAll(/^### `([a-z_]+)`$/gm)];
  if (headings.length === 0) {
    throw new Error('The Data Model section in docs/backend-design.md documents no tables.');
  }

  const schema: DocumentedSchema = new Map();
  for (const [index, heading] of headings.entries()) {
    const name = heading[1];
    const sectionStart = (heading.index ?? 0) + heading[0].length;
    const sectionEnd =
      index + 1 < headings.length
        ? (headings[index + 1].index ?? dataModel.length)
        : dataModel.length;
    const section = dataModel.slice(sectionStart, sectionEnd);
    const columns: DocumentedColumn[] = [];

    for (const line of section.split('\n')) {
      const cells = parseTableRow(line);
      if (!cells) continue;
      const columnName = cells[0].match(/^`([a-z_]+)`$/)?.[1];
      const documentedType = cells[1].match(/^`([A-Z]+)`$/)?.[1];
      if (!columnName || !documentedType) continue;
      const type = documentedTypes[documentedType];
      if (!type) {
        throw new Error(
          `docs/backend-design.md documents unsupported column type "${documentedType}" for ${name}.${columnName}.`,
        );
      }
      columns.push(parseColumn(columnName, type, cells[2] ?? ''));
    }

    schema.set(name, {
      name,
      columns,
      indexes: parseDocumentedIndexes(section),
      allNullCheckColumns: parseAllNullCheckColumns(section),
    });
  }

  return schema;
}

function indexColumns(indexDefinition: string): string[] {
  const match = indexDefinition.match(/\(([^)]*)\)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(stripIndexOrder)
    .filter((column) => column.length > 0);
}

async function readActualSchema(client: Client, schemaName: string): Promise<ActualSchema> {
  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schemaName],
  );
  const columns = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, ordinal_position`,
    [schemaName],
  );
  const primaryKeys = await client.query<{ table_name: string; columns: string[] }>(
    `SELECT t.relname AS table_name,
            array_agg(a.attname ORDER BY keys.ordinality)::text[] AS columns
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality) ON true
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = keys.attnum
     WHERE c.contype = 'p' AND n.nspname = $1
     GROUP BY t.relname`,
    [schemaName],
  );
  const uniqueConstraints = await client.query<{
    table_name: string;
    conname: string;
    columns: string[];
  }>(
    `SELECT t.relname AS table_name,
            c.conname,
            array_agg(a.attname ORDER BY keys.ordinality)::text[] AS columns
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality) ON true
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = keys.attnum
     WHERE c.contype = 'u' AND n.nspname = $1
     GROUP BY t.relname, c.conname`,
    [schemaName],
  );
  const foreignKeys = await client.query<{
    table_name: string;
    column_name: string;
    ref_table: string;
    ref_column: string;
  }>(
    `SELECT t.relname AS table_name,
            a.attname AS column_name,
            rt.relname AS ref_table,
            ra.attname AS ref_column
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class rt ON rt.oid = c.confrelid
     JOIN pg_namespace rn ON rn.oid = rt.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
     WHERE c.contype = 'f'
       AND n.nspname = $1
       AND rn.nspname = $1
       AND cardinality(c.conkey) = 1
       AND cardinality(c.confkey) = 1`,
    [schemaName],
  );
  const checks = await client.query<{
    table_name: string;
    conname: string;
    definition: string;
  }>(
    `SELECT t.relname AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE c.contype = 'c' AND n.nspname = $1`,
    [schemaName],
  );
  const indexes = await client.query<{
    tablename: string;
    indexname: string;
    indexdef: string;
  }>(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1
     ORDER BY tablename, indexname`,
    [schemaName],
  );
  const constraintIndexes = await client.query<{ table_name: string; index_name: string }>(
    `SELECT t.relname AS table_name, i.relname AS index_name
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class i ON i.oid = c.conindid
     WHERE c.contype IN ('p', 'u', 'x') AND n.nspname = $1`,
    [schemaName],
  );

  const constraintIndexNames = new Set(
    constraintIndexes.rows.map((row) => `${row.table_name}.${row.index_name}`),
  );
  const schema: ActualSchema = new Map();
  for (const table of tables.rows) {
    schema.set(table.table_name, {
      columns: [],
      primaryKey: [],
      indexes: [],
      foreignKeys: [],
      uniqueConstraints: [],
      checks: [],
    });
  }
  for (const column of columns.rows) {
    schema.get(column.table_name)?.columns.push({
      name: column.column_name,
      type: column.data_type,
      nullable: column.is_nullable === 'YES',
      defaultValue: column.column_default,
    });
  }
  for (const primaryKey of primaryKeys.rows) {
    const table = schema.get(primaryKey.table_name);
    if (table) table.primaryKey = primaryKey.columns;
  }
  for (const unique of uniqueConstraints.rows) {
    schema
      .get(unique.table_name)
      ?.uniqueConstraints.push({ name: unique.conname, columns: unique.columns });
  }
  for (const foreignKey of foreignKeys.rows) {
    schema.get(foreignKey.table_name)?.foreignKeys.push({
      column: foreignKey.column_name,
      table: foreignKey.ref_table,
      refColumn: foreignKey.ref_column,
    });
  }
  for (const check of checks.rows) {
    schema
      .get(check.table_name)
      ?.checks.push({ name: check.conname, definition: check.definition });
  }
  for (const index of indexes.rows) {
    schema.get(index.tablename)?.indexes.push({
      name: index.indexname,
      columns: indexColumns(index.indexdef),
      constraintBacked: constraintIndexNames.has(`${index.tablename}.${index.indexname}`),
    });
  }

  return schema;
}

function signature(tableName: string, columns: string[]): string {
  return `${tableName}(${[...columns].sort().join(', ')})`;
}

function sameMembers(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function diffSchemas(documented: DocumentedSchema, actual: ActualSchema): string[] {
  const drift: string[] = [];
  const documentedUniqueConstraints = new Map<string, string[]>();
  const actualUniqueConstraints = new Map<string, string[]>();
  const documentedForeignKeys = new Map<string, string>();
  const actualForeignKeys = new Map<string, string>();

  for (const [tableName, documentedTable] of documented) {
    const actualTable = actual.get(tableName);
    if (!actualTable) {
      drift.push(`Missing table "${tableName}" documented in docs/backend-design.md.`);
      continue;
    }

    const actualColumns = new Map(actualTable.columns.map((column) => [column.name, column]));
    for (const documentedColumn of documentedTable.columns) {
      const actualColumn = actualColumns.get(documentedColumn.name);
      if (!actualColumn) {
        drift.push(
          `Missing column "${tableName}.${documentedColumn.name}" documented in docs/backend-design.md.`,
        );
        continue;
      }
      actualColumns.delete(documentedColumn.name);

      if (documentedColumn.type !== actualColumn.type) {
        drift.push(
          `Column "${tableName}.${documentedColumn.name}" is documented as ${documentedColumn.type} but the applied schema has ${actualColumn.type}.`,
        );
      }
      if (documentedColumn.nullable !== actualColumn.nullable) {
        drift.push(
          documentedColumn.nullable
            ? `Column "${tableName}.${documentedColumn.name}" is documented as nullable but the applied schema requires a value.`
            : `Column "${tableName}.${documentedColumn.name}" is documented as NOT NULL but the applied schema allows NULL.`,
        );
      }
      if (documentedColumn.defaultValue !== actualColumn.defaultValue) {
        drift.push(
          `Column "${tableName}.${documentedColumn.name}" is documented with default ${documentedColumn.defaultValue ?? '(none)'} but the applied schema has ${actualColumn.defaultValue ?? '(none)'}.`,
        );
      }

      if (documentedColumn.unique) {
        documentedUniqueConstraints.set(signature(tableName, [documentedColumn.name]), [
          documentedColumn.name,
        ]);
      }
      if (documentedColumn.uniqueWith) {
        documentedUniqueConstraints.set(
          signature(tableName, [documentedColumn.name, documentedColumn.uniqueWith]),
          [documentedColumn.name, documentedColumn.uniqueWith],
        );
      }
      if (documentedColumn.foreignKey) {
        const target = documentedColumn.foreignKey;
        const key = `${tableName}.${documentedColumn.name}->${target.table}.${target.column}`;
        documentedForeignKeys.set(key, key);
      }
      for (const enumValue of documentedColumn.enumValues) {
        if (!actualTable.checks.some((check) => check.definition.includes(enumValue))) {
          drift.push(
            `Check constraint on "${tableName}.${documentedColumn.name}" is documented to allow "${enumValue}" but the applied schema does not.`,
          );
        }
      }
      for (const expression of documentedColumn.expressionChecks) {
        if (
          !actualTable.checks.some((check) =>
            check.definition.replace(/\s+/g, ' ').includes(expression.replace(/\s+/g, ' ')),
          )
        ) {
          drift.push(
            `Check constraint "${expression}" on "${tableName}.${documentedColumn.name}" is documented but missing from the applied schema.`,
          );
        }
      }
    }
    for (const actualColumn of actualColumns.values()) {
      drift.push(
        `Undocumented column "${tableName}.${actualColumn.name}" exists in the applied schema.`,
      );
    }

    const documentedPrimaryKey =
      documentedTable.columns.find((column) => column.compositePrimaryKey)?.compositePrimaryKey ??
      documentedTable.columns
        .filter((column) => column.singlePrimaryKey)
        .map((column) => column.name);
    if (!sameMembers(documentedPrimaryKey, actualTable.primaryKey)) {
      drift.push(
        `Primary key (${documentedPrimaryKey.join(', ') || 'none'}) on "${tableName}" is documented but the applied schema has (${actualTable.primaryKey.join(', ') || 'none'}).`,
      );
    }

    if (documentedTable.allNullCheckColumns.length > 0) {
      const columns = documentedTable.allNullCheckColumns;
      if (
        !actualTable.checks.some((check) =>
          columns.every((column) => check.definition.includes(column)),
        )
      ) {
        drift.push(
          `Check constraint requiring (${columns.join(', ')}) on "${tableName}" to be all NULL or all populated is documented but missing from the applied schema.`,
        );
      }
    }

    const documentedChecks: ((definition: string) => boolean)[] = [];
    for (const column of documentedTable.columns) {
      if (column.enumValues.length > 0) {
        documentedChecks.push((definition) =>
          column.enumValues.every((value) => definition.includes(value)),
        );
      }
      for (const expression of column.expressionChecks) {
        const normalizedExpression = expression.replace(/\s+/g, ' ');
        documentedChecks.push((definition) => definition.includes(normalizedExpression));
      }
    }
    if (documentedTable.allNullCheckColumns.length > 0) {
      const columns = documentedTable.allNullCheckColumns;
      documentedChecks.push((definition) => columns.every((column) => definition.includes(column)));
    }
    for (const check of actualTable.checks) {
      const definition = check.definition.replace(/\s+/g, ' ');
      if (!documentedChecks.some((matches) => matches(definition))) {
        drift.push(`Undocumented check constraint "${check.name}" exists on table "${tableName}".`);
      }
    }

    const documentedIndexNames = new Set(documentedTable.indexes.map((index) => index.name));
    for (const documentedIndex of documentedTable.indexes) {
      const actualIndex = actualTable.indexes.find((index) => index.name === documentedIndex.name);
      if (!actualIndex) {
        drift.push(`Missing index "${documentedIndex.name}" documented on table "${tableName}".`);
        continue;
      }
      if (!sameMembers(documentedIndex.columns, actualIndex.columns)) {
        drift.push(
          `Index "${documentedIndex.name}" on table "${tableName}" is documented with columns (${documentedIndex.columns.join(', ')}) but the applied schema has (${actualIndex.columns.join(', ')}).`,
        );
      }
    }
    for (const actualIndex of actualTable.indexes) {
      if (!actualIndex.constraintBacked && !documentedIndexNames.has(actualIndex.name)) {
        drift.push(`Undocumented index "${actualIndex.name}" exists on table "${tableName}".`);
      }
    }

    for (const unique of actualTable.uniqueConstraints) {
      actualUniqueConstraints.set(signature(tableName, unique.columns), unique.columns);
    }
    for (const foreignKey of actualTable.foreignKeys) {
      const key = `${tableName}.${foreignKey.column}->${foreignKey.table}.${foreignKey.refColumn}`;
      actualForeignKeys.set(key, key);
    }
  }

  for (const tableName of actual.keys()) {
    if (!documented.has(tableName)) {
      drift.push(`Undocumented table "${tableName}" exists in the applied schema.`);
    }
  }

  for (const [key, columns] of documentedUniqueConstraints) {
    if (!actualUniqueConstraints.has(key)) {
      drift.push(
        `Unique constraint (${columns.join(', ')}) on "${key.slice(0, key.indexOf('('))}" is documented but missing from the applied schema.`,
      );
    }
  }
  for (const [key, columns] of actualUniqueConstraints) {
    if (!documentedUniqueConstraints.has(key)) {
      drift.push(
        `Undocumented unique constraint (${columns.join(', ')}) exists on "${key.slice(0, key.indexOf('('))}".`,
      );
    }
  }
  for (const [key] of documentedForeignKeys) {
    if (!actualForeignKeys.has(key)) {
      const [column, target] = key.split('->');
      drift.push(
        `Foreign key "${column}" to "${target}" is documented but missing from the applied schema.`,
      );
    }
  }
  for (const [key] of actualForeignKeys) {
    if (!documentedForeignKeys.has(key)) {
      const [column, target] = key.split('->');
      drift.push(
        `Undocumented foreign key "${column}" to "${target}" exists in the applied schema.`,
      );
    }
  }

  return drift;
}

integration('Documented data model matches the migrated schema', () => {
  const schemaName = `schema_drift_${process.pid}_${Date.now().toString(36)}`;
  let client: Client | undefined;
  let documented: DocumentedSchema;
  let actual: ActualSchema;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required.');
    client = new Client({
      connectionString: testDatabaseUrl,
      connectionTimeoutMillis: 10_000,
      query_timeout: 20_000,
    });
    await client.connect();

    try {
      await client.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);

      // Apply the real migration runner in a throwaway schema so this test neither races the
      // other database-backed suites nor mutates their shared public schema.
      const scratchUrl = new URL(testDatabaseUrl);
      scratchUrl.searchParams.set('options', `-c search_path=${schemaName}`);
      scratchUrl.searchParams.set('application_name', 'aidtrace-schema-drift-test');
      const originalRuntimeUrl = process.env.DATABASE_URL;
      const originalMigrationUrl = process.env.DATABASE_URL_UNPOOLED;
      process.env.DATABASE_URL = scratchUrl.toString();
      process.env.DATABASE_URL_UNPOOLED = scratchUrl.toString();
      try {
        const { migrate } = await import('../scripts/migrate.js');
        await migrate();
      } finally {
        if (originalRuntimeUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalRuntimeUrl;
        if (originalMigrationUrl === undefined) delete process.env.DATABASE_URL_UNPOOLED;
        else process.env.DATABASE_URL_UNPOOLED = originalMigrationUrl;
      }

      documented = await readDocumentedSchema();
      actual = await readActualSchema(client, schemaName);
    } catch (error) {
      await client
        .query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
        .catch(() => {});
      await client.end().catch(() => {});
      client = undefined;
      throw error;
    }
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
    } finally {
      await client.end();
    }
  });

  it('matches every documented table, column, index, key, and check constraint', () => {
    const drift = diffSchemas(documented, actual);
    if (drift.length > 0) {
      throw new Error(
        `Schema drift between docs/backend-design.md and the applied migrations:\n${drift
          .map((entry) => `  - ${entry}`)
          .join('\n')}`,
      );
    }
    expect(drift).toEqual([]);
  });

  it('reports a renamed documented column by table and column name', async () => {
    await client!.query('BEGIN');
    try {
      await client!.query(
        `ALTER TABLE ${quoteIdentifier(schemaName)}.rate_limits RENAME COLUMN request_count TO request_count_drifted`,
      );
      const drift = diffSchemas(documented, await readActualSchema(client!, schemaName));
      expect(drift).toContain(
        'Missing column "rate_limits.request_count" documented in docs/backend-design.md.',
      );
      expect(drift).toContain(
        'Undocumented column "rate_limits.request_count_drifted" exists in the applied schema.',
      );
    } finally {
      await client!.query('ROLLBACK');
    }
  });

  it('reports a renamed documented index by table and index name', async () => {
    await client!.query('BEGIN');
    try {
      await client!.query(
        `ALTER INDEX ${quoteIdentifier(schemaName)}.rate_limits_expiry_idx RENAME TO rate_limits_expiry_drifted_idx`,
      );
      const drift = diffSchemas(documented, await readActualSchema(client!, schemaName));
      expect(drift).toContain(
        'Missing index "rate_limits_expiry_idx" documented on table "rate_limits".',
      );
      expect(drift).toContain(
        'Undocumented index "rate_limits_expiry_drifted_idx" exists on table "rate_limits".',
      );
    } finally {
      await client!.query('ROLLBACK');
    }
  });
});
