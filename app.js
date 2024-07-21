import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import { createNodeMiddleware } from "@octokit/webhooks";
import fs from "fs";
import http from "http";
import { exec } from "child_process";

dotenv.config();

const personalAccessToken = process.env.GITHUB_TOKEN;

if (!personalAccessToken) {
  console.error('GITHUB_TOKEN is not set in the environment');
  process.exit(1);
}

const octokit = new Octokit({
  auth: personalAccessToken,
});

// Define messages
const welcomeMessage = "Thanks for opening a new PR! Please follow our contributing guidelines to make your PR easier to review.";
const deploymentMessage = (url) => `🚀 Deployment started for this PR! You can check it out here: [${url}](${url}) 🌟`;
const closeMessage = "This PR has been closed without merging. Thanks for your contributions!";

// Helper function to deploy container and get URL
async function deployContainer(owner, repo, prNumber) {
  return new Promise((resolve, reject) => {
    exec(`./deploy.sh ${repo} ${prNumber}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error deploying container: ${stderr}`);
        reject(`Error: ${stderr}`);
      } else {
        console.log(`Deployment script output: ${stdout}`);
        resolve(stdout.trim());
      }
    });
  });
}

// Handle pull request opened event
async function handlePullRequestOpened({ payload }) {
  console.log(`Received a pull request event for #${payload.pull_request.number}`);

  try {
    const url = await deployContainer(payload.repository.name, payload.pull_request.number);

    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: `${welcomeMessage}\n${deploymentMessage(url)}`,
    });
  } catch (error) {
    console.error(`Error posting comment: ${error}`);
  }
}

// Handle pull request closed (merged) event
async function handlePullRequestClosed({ payload }) {
  console.log(`Received a pull request closed event for #${payload.pull_request.number}`);

  try {
    await octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: closeMessage,
    });
  } catch (error) {
    console.error(`Error posting close comment: ${error}`);
  }
}

// Set up webhook event listeners for pull request events
const webhooks = new createNodeMiddleware({
  secret: process.env.WEBHOOK_SECRET,
});

webhooks.on("pull_request.opened", handlePullRequestOpened);
webhooks.on("pull_request.closed", handlePullRequestClosed);

// Log any errors that occur
webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
  } else {
    console.error(error);
  }
});

// Define server details and webhook path
const port = 3000;
const host = '0.0.0.0';
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

// Create middleware for handling webhook events
const middleware = createNodeMiddleware(webhooks, { path });

// Create and start the HTTP server
http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`);
  console.log('Press Ctrl + C to quit.');
});
