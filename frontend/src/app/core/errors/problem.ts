import { HttpErrorResponse } from '@angular/common/http';
import { ProblemCode } from '../../api/generated/model';

export type { ProblemCode };

/** The `code` of a failed request's problem response, if it has one. */
export function problemCode(error: unknown): ProblemCode | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }
  return (error.error as { code?: ProblemCode } | null)?.code;
}
