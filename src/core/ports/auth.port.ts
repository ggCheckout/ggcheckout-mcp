export interface AuthPort {
  getMyBusinessId(): Promise<string>;
}
