import simpleGit, { SimpleGit } from 'simple-git';
import { CommitInfo } from './types';

/**
 * Check if the given path is a valid git repository
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  const git: SimpleGit = simpleGit(repoPath);
  try {
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

/**
 * Fetch commits from a git repository since a given date
 */
export async function getCommits(
  repoPath: string,
  since: string
): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if it's a valid git repository
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(
      `Not a git repository: ${repoPath}\n` +
        'Please run this command from within a git repository or specify a valid repo path with --repo.'
    );
  }

  // Use custom format to get structured commit data
  // %h = short hash, %aI = author date (ISO), %an = author name, %s = subject, %b = body
  const SEPARATOR = '---COMMIT_SEPARATOR---';
  const FIELD_SEPARATOR = '---FIELD---';

  const log = await git.raw([
    'log',
    `--since=${since}`,
    `--pretty=format:%h${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b${SEPARATOR}`,
  ]);

  if (!log.trim()) {
    return [];
  }

  return parseGitLog(log, SEPARATOR, FIELD_SEPARATOR);
}

/**
 * Parse raw git log output into structured commit objects
 */
export function parseGitLog(
  raw: string,
  commitSeparator: string,
  fieldSeparator: string
): CommitInfo[] {
  const commits: CommitInfo[] = [];
  const rawCommits = raw.split(commitSeparator).filter((c) => c.trim());

  for (const rawCommit of rawCommits) {
    const parts = rawCommit.split(fieldSeparator);
    if (parts.length >= 4) {
      const [hash, date, author, message, ...bodyParts] = parts;
      const body = bodyParts.join(fieldSeparator).trim();

      commits.push({
        hash: hash.trim(),
        date: date.trim(),
        author: author.trim(),
        message: message.trim(),
        body: body || undefined,
      });
    }
  }

  return commits;
}

/**
 * Get the date range for the commits
 */
export function getDateRange(commits: CommitInfo[]): { start: string; end: string } {
  if (commits.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  }

  const dates = commits.map((c) => new Date(c.date));
  const oldest = new Date(Math.min(...dates.map((d) => d.getTime())));
  const newest = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    start: oldest.toISOString().split('T')[0],
    end: newest.toISOString().split('T')[0],
  };
}
