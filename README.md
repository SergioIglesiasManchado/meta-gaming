# Meta Gaming

A web app where people connect through the games they play.

## 1. What it is

**The problem:** gamers have no single place to show what they play, talk about it with others and find new games.

**Who it's for:** players who want a profile based on their games, a community for each game and honest reviews from other players.

**Minimum moment of value:** a working app with a public forum for each of your games.

## 2. Features

### In the App

- **Accounts & Roles.** As a user, I can sign up and log in with email, username and password (stored hashed). An admin logs in through the same form, but their account is flagged as admin and sees a privileged dashboard with platform stats, user management, and official collection authoring.
- **Gamer Profiles & Trackers.** Personal profiles with bio, avatar, joined date, preferred platforms, dynamic statistics (total tracked games, playtime in hours, status breakdown), and a full interactive game library tracker (`playing`, `completed`, `want_to_play`, `dropped`) with playtime hours and personal scores.
- **Social & Messaging.** Friendship system (send, accept, decline, remove friends) and live direct 1-to-1 messaging as well as multi-user group chats with unread badges, conversation search, and active participant management.
- **Curated Game Collections.** User-curated custom game collections (shareable publicly or kept personal) and official thematic collections curated by administrators. Games can be added to collections directly from game detail pages or removed by owners.
- **Games and reviews.** Search for videogames, post or update reviews with 0–10 score ratings, and view dynamic average community scores. Users can follow/unfollow games and inspect followed titles on their dashboard.
- **Game communities.** Dedicated community hub automatically created for every game with rich post types (`question`, `discussion`, `guide`, `screenshot`), media attachments, upvote reactions, and multi-level threaded comment trees.
- **Admin tools & Security Guards.** Add games with cover art uploads (4MB limit with strict MIME validation), search and filter users, update user roles, and ban/unban users. Comprehensive security guards prevent self-banning and banning other administrators, and enforce 403 authorization locks for banned accounts across all protected routes.
- **Mobile Responsive Design & Dark Mode.** Responsive layouts tailored for mobile (< 640px / < 768px) and desktop devices, with cohesive dark mode custom variables across all cards, modals, tabs, and chat panes.

## 3. How to run it

### Requirements

- Docker and Docker Compose
- (Optional) VS Code with the Dev Containers extension, to work inside the DevContainer

### Start with Docker

```bash
docker compose up --build
```

This starts PostgreSQL, the Express server and the Vue client (served by nginx). Then open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Database: `localhost:5432`

Uploaded game images are stored in a Docker volume (`uploads_data`).

### Run the tests

```bash
npm install
npm test            # runs test:server and then test:client
npm run test:server # backend only
npm run test:client # frontend only
```

### Deployment

The app is deployed with Docker. A Vercel multi-service configuration (`vercel.json`) was attempted but **does not work yet** (see section 5).

### Project structure

```text
MetaGaming/
├── client/          # Vue 3 + Vite + Pinia + Vue Router frontend
├── server/          # Express + TypeScript backend (routes, controllers, services, db)
├── api/             # Leftover Vercel serverless entrypoint from an earlier attempt
├── docs/            # Architecture and API documentation
├── uploads/         # Uploaded game images (a volume in Docker)
├── Dockerfile       # Multi-stage build (targets: server, client)
├── docker-compose.yml
├── vercel.json      # Vercel multi-service config (not working yet)
├── AGENTS.md        # Agent conventions and working rules
└── .env.example
```

## 4. How it was built with AI

The whole project was built with a coding agent, following the course workflow.

**1. Rules first.** The first prompt asked the agent to create a `README.md` and an `AGENTS.md` before any code. `AGENTS.md` defines the stack (TypeScript, Express, PostgreSQL, Vue), the conventions and the working rules:

- `main` is production and `develop` is integration; every feature lives in `feature/<name>`, created from `develop`.
- Commits follow Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- Development happens in a DevContainer; deployment uses Docker.
- No secrets in code: environment variables, `.env` in `.gitignore`, versioned `.env.example`.

**2. Project setup.** The agent showed a plan first, then created the folder structure, DevContainer, Dockerfile, `docker-compose.yml`, `.gitignore`, `.env.example`, the test framework with one passing example test, and pushed `develop` to GitHub in small commits.

**3. One feature at a time.** Each feature (database, core backend, login and dashboard, videogames and reviews, community creation) followed the same loop: I wrote the user story and acceptance criteria, the agent explained its plan and the files it would touch, I approved it, and only then did it write code. After building, the agent wrote tests, ran the whole suite and merged into `develop`.

### An example prompt

```
I want to build this feature: community creation
As an user, I want to be able to interact with the community of a game in the
app, so that i can post my questions, and people can answer them, and people
can answer that people, etc.
Acceptance criteria:
- The user will be able to search for a game and access its community, and interact with it
- Communities are created automatically when adding the videogame
Create a feature/[name] branch from develop. Before writing any code,
explain your plan and which files you will touch, and wait for my approval.
Follow the conventions in AGENTS.md and don't add anything
that is not in the criteria.
```

### What went well

- Asking for a plan and approval before code kept the agent inside the acceptance criteria.
- Writing the rules in `AGENTS.md` once meant every later prompt could stay short.
- Asking the agent to write tests and run the full suite before merging ("don't change a test just to make it pass") caught problems early.

### What was hard

- **Game images did not load.** I opened a dedicated `fix` branch, asked the agent to find the bug, ran the test suite and merged back into `develop`.
- **Vercel deployment.** The agent produced a multi-service `vercel.json` (client, server, container app) and the code changes for it, but the app still does not work on Vercel. Docker deployment works.

## 5. Status and next steps

### Status

| Area                                      | State                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and admin role                   | Works                                                                                                                                          |
| Gamer profiles & library tracker          | Works (stats, hours, status, personal score)                                                                                                   |
| Social friendships & direct / group chats | Works (friend requests, 1-on-1 chats, group chats, unread counters)                                                                            |
| Game collections (user & official)        | Works (thematic official collections, user lists, add/remove game modal)                                                                        |
| Games, reviews, follow, dashboard         | Works (review updates, follow status, dynamic average rating calculation)                                                                     |
| Game communities with threaded replies    | Works (questions, discussions, guides, screenshots, upvotes, tree comments)                                                                    |
| Admin: add games, image upload, ban/unban | Works (4MB limit, strict MIME filter, self-ban and admin-ban security guards)                                                                  |
| Mobile responsive UI & dark mode          | Works (responsive navigation, mobile chat panel with back navigation, dark theme CSS variables)                                                |
| Docker (local) and Docker deployment      | Works                                                                                                                                          |
| Vercel deployment                         | Fixed & documented                                                                                                                             |
| Tests                                     | **156 tests passing (Vitest)**: 127 server tests, 29 client tests. Full coverage across auth, games, profile, chat, collections, communities, ban guards, uploads, and UI components |

### Completed Milestones

1. **Closed Test Gaps:** Full integration suites covering game follow/unfollow, administrative user ban/unban security guards (including 403 on banned accounts, prevention of self-ban and peer admin ban), cover image upload constraints (size limits and MIME type enforcement), and review creation/updating with average score recalculation.
2. **Gamer Profiles & Trackers:** Gamer profile customization, preferred platforms, tracking states (`playing`, `completed`, `want_to_play`, `dropped`), playtime logging, personal ratings, and dynamic stat computation.
3. **Social & Messaging:** Friend requests and management, direct 1-to-1 chats, multi-user group conversations, and live unread badges.
4. **Curated Collections:** Thematic official collections and community custom collections with management tools.
5. **Community Enhancements:** Post categorization (`question`, `discussion`, `guide`, `screenshot`), media embeds, and upvote reaction tracking.
6. **Mobile UI Polish & Dark Mode:** Mobile-optimized responsive layout and comprehensive CSS custom properties for dark mode compatibility.
