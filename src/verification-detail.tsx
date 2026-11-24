export type VerificationEvidence = {
  status: string;
  checkedAt?: string;
  differences?: string[];
  ledger?: number;
  createdAt?: string;
  reason?: string;
  memo?: string;
  memoType?: string;
};

export type VerificationDetailRecord = {
  verification?: VerificationEvidence;
};

function formatTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function VerificationDetail({ record }: { record: VerificationDetailRecord }) {
  const verification = record.verification;
  const checkedAt = formatTimestamp(verification?.checkedAt);
  const transactionCreatedAt = formatTimestamp(verification?.createdAt);

  return (
    <>
      <div>
        <dt>Last verification check</dt>
        <dd>
          {checkedAt ? (
            <time dateTime={verification?.checkedAt} aria-label="Last verification check time">
              {checkedAt}
            </time>
          ) : (
            'No verification check recorded'
          )}
        </dd>
      </div>
      {transactionCreatedAt && (
        <div>
          <dt>Transaction created</dt>
          <dd>
            <time dateTime={verification?.createdAt}>{transactionCreatedAt}</time>
          </dd>
        </div>
      )}
      {verification?.ledger !== undefined && (
        <div>
          <dt>Ledger</dt>
          <dd>{verification.ledger.toLocaleString()}</dd>
        </div>
      )}
      {verification?.reason && (
        <div>
          <dt>Verification note</dt>
          <dd>{verification.reason}</dd>
        </div>
      )}
      {verification?.memo && verification.memoType && (
        <div>
          <dt>Memo</dt>
          <dd>
            {verification.memoType}: {verification.memo}
          </dd>
        </div>
      )}
    </>
  );
}
