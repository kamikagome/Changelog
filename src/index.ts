#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';

import { getCommits, getDateRange } from './git';
import { summarizeCommits } from './summarize';
import { formatMarkdown, formatHTML } from './formatter';
import { CLIOptions } from './types';

// Load environment variables from .env file
config();

program
  .name('changelog-digest')
  .description('Generate plain-English changelog from git history using Claude AI')
  .version('1.0.0')
  .option('-s, --since <date>', 'Start date for commits', '7 days ago')
  .option('-r, --repo <path>', 'Repository path', '.')
  .option('-f, --format <type>', 'Output format (markdown|html)', 'markdown')
  .option('-o, --output <file>', 'Output file path')
  .option('-a, --audience <type>', 'Target audience (general|sales|ops|cx)', 'general')
  .action(async (options: CLIOptions) => {
    try {
      await run(options);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('Error:'), error.message);
      } else {
        console.error(chalk.red('An unexpected error occurred'));
      }
      process.exit(1);
    }
  });

program.parse();

async function run(options: CLIOptions): Promise<void> {
  const repoPath = path.resolve(options.repo);

  // Check for API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('Error:'), 'Missing ANTHROPIC_API_KEY');
    console.error(chalk.dim('Set it in your .env file or export it:'));
    console.error(chalk.dim('  export ANTHROPIC_API_KEY=your-api-key-here'));
    process.exit(1);
  }

  // Fetch commits
  const fetchSpinner = ora('Fetching commits...').start();
  let commits;
  try {
    commits = await getCommits(repoPath, options.since);
    fetchSpinner.succeed(`Found ${commits.length} commits`);
  } catch (error) {
    fetchSpinner.fail('Failed to fetch commits');
    throw error;
  }

  // Handle no commits
  if (commits.length === 0) {
    console.log(chalk.yellow('No commits found in this period.'));
    console.log(chalk.dim(`Try a longer range: --since "1 month ago"`));
    return;
  }

  // Get date range
  const dateRange = getDateRange(commits);
  console.log(chalk.dim(`Period: ${dateRange.start} → ${dateRange.end}`));

  // Summarize with Claude
  const summarizeSpinner = ora('Summarizing with Claude AI...').start();
  let sections;
  try {
    sections = await summarizeCommits(commits, options.audience);
    summarizeSpinner.succeed('Summary generated');
  } catch (error) {
    summarizeSpinner.fail('Failed to generate summary');
    throw error;
  }

  // Format output
  let output: string;
  if (options.format === 'html') {
    output = formatHTML(sections, dateRange);
  } else {
    output = formatMarkdown(sections, dateRange);
  }

  // Write output
  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, output, 'utf-8');
    console.log(chalk.green('✓'), `Saved to ${outputPath}`);
  } else {
    console.log('');
    console.log(output);
  }
}
