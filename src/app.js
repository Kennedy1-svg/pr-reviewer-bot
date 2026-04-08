const express = require("express")
const { Octokit } = require("@octokit/rest")
const { createAppAuth } = require("@octokit/auth-app")
const Anthropic = require("@anthropic-ai/sdk")
dotenv = require("dotenv").config()


const app = express()
app.use(express.json())

async function reviewWithClaude(diff) {
  console.log('Reviewing with Claude', { diff }) // log the diff being sent to Claude
  const res = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `
You are a strict senior engineer.

Review this PR diff and:
- find bugs
- detect security issues
- suggest improvements

Be concise.

${diff}
`,
      },
    ],
  })



  return res.content[0].text
}


async function postComment(owner, repo, prNumber, comment) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: `🤖 AI Review Bot\n\n${comment}`,
  })
}

async function handlePR(payload) {
  console.log('Received PR event', { payload }) // also fix typo: come.log ❌

  const owner = payload.repository.owner.login
  const repo = payload.repository.name
  const prNumber = payload.pull_request.number

  console.log('Handling PR', { owner, repo, prNumber })

  const files = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  })

  console.log('files', files)

  const diff = files.data
    .map(file => `File: ${file.filename}\n${file.patch || ""}`)
    .join("\n\n")


    console.log('Generated diff', { diff }) // log the generated diff

  if (!diff) return

  const review = await reviewWithClaude(diff)

  console.log('Generated review', { review })

  await postComment(owner, repo, prNumber, review)
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// console.log('Anthropic client initialized', { anthropic }) // log the initialized Anthropic client
console.log('Environment variables', {
  APP_ID: process.env.APP_ID,
  INSTALLATION_ID: process.env.INSTALLATION_ID,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***' : 'not set', // don't log the actual API key
  privateKey: process.env.PRIVATE_KEY ? '***' : 'not set' // don't log the actual private key
})
const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: Number(process.env.APP_ID), // ✅ safest
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    installationId: Number(process.env.INSTALLATION_ID) 
  },
})

console.log('App initialized with Octokit and Anthropic',typeof process.env.APP_ID, typeof process.env.INSTALLATION_ID)

app.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"]
  // console.log('req', req)

  if (event === "pull_request") {
    const action = req.body.action

    if (["opened", "synchronize"].includes(action)) {
      await handlePR(req.body)
    }
  }

  res.sendStatus(200)
})

app.get("/", (req, res) => {
  res.send("Hello World!")
})


  app.listen(3000, () => {
    console.log("Server is running on port 3000")   
})  
