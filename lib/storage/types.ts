export type AzureBlobRepositoryOptions = {
  containerName?: string;
  /**
   * Prefix to group blobs logically (e.g. "attachments/2025/01").
   */
  pathPrefix?: string;
  /**
   * Default expiration (seconds) for temporary download URLs.
   */
  urlExpirationSeconds?: number;
};

export type ProxySettings = {
  host: string;
  port: number;
  username?: string;
  password?: string;
};
