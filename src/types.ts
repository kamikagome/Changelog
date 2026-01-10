export interface CommitInfo {
  hash: string;
  date: string;
  author: string;
  message: string;
  body?: string;
}

export interface DigestSection {
  category: 'features' | 'fixes' | 'improvements' | 'other';
  items: string[];
}

export interface CLIOptions {
  since: string;
  repo: string;
  format: 'markdown' | 'html';
  output?: string;
  audience: 'general' | 'sales' | 'ops' | 'cx';
}

export interface DateRange {
  start: string;
  end: string;
}
