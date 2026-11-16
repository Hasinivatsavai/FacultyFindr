# FacultyFindr with SQLite

This ZIP contains the backend, the redesigned frontend connected to it, and a ready-to-run build. The application starts one localhost server for both the website and its API.

## Start on Windows

1. In your old frontend terminal, press **Ctrl+C** if it is still running.
2. Right-click the ZIP and choose **Extract All** into a new folder, e.g. `Downloads\FacultyFindr_Backend`.
3. In VS Code select **File → Open Folder** and open that extracted folder. Its top level contains `package.json`, `server`, `src`, and `dist`.
4. Select **Terminal → New Terminal**. Use Node.js 24.x, or Node.js 22.12 and later in the 22.x line. Run:

   ```powershell
   node -v
   npm start
   ```

5. Open **http://localhost:5173** or the URL printed in the terminal. Keep that terminal running. On a PowerShell installation with npm script execution restrictions, use `npm.cmd start`.

The prebuilt app uses Node’s built-in HTTP server and SQLite. The first launch creates all tables, sample records, and the local storage directory automatically. Some Node versions print an experimental SQLite warning at startup and continue serving the site.

## Use it

- **Students** can use the directory, search, open faculty profiles and check class schedules without signing in. The directory refreshes while it is visible and when you return to the tab.
- **Faculty** can open **Faculty space → Create account**. Set up a personal account to save contact details, academic information, a profile photograph, recurring teaching periods, free periods, and breaks. Changes become visible to anyone using this instance of the directory. The campus clock drives current availability and expires manual status changes when the active free period ends.
- **Sample login** is `aisha@faculty.demo` with password `FacultyDemo1!`. The **Open demo** selector also includes Omar Hassan and Meera Nair. All three are fictional faculty accounts for trying the workflow. Changes made while using these demo accounts are shared across people using the same database.
- The server stores passwords as salted scrypt hashes and uses expiring HTTP-only cookie sessions. Signing out revokes that session. Each account edits its own faculty record.

## Storage and backups

The database is **data/facultyfindr.sqlite**, relative to this project folder. It contains accounts, profiles, weekly schedules, availability, sessions, and photo thumbnails. Restarting the application or closing the browser preserves the database. The earlier frontend kept its own accounts and edits in browser storage. This edition starts a separate database and never uploads those old records automatically.

**Back up** by stopping FacultyFindr with **Ctrl+C** and copying the entire **data** directory to a secure location. **Restore** by stopping the server, setting aside any existing data directory, copying the backup into the project as **data**, and starting the server again. Treat backups as private because they contain account records and faculty information. To move to another computer, install a supported Node version and move both this application and that directory.

## Edit the source in VS Code

The usual frontend workflow starts both the API and the Vite development server in one terminal:

```powershell
npm ci
npm run dev
```

This installs the locked frontend tools and enables frontend hot reload. Both launch modes use the same database. After editing frontend files, stop dev mode, then use `npm run build` followed by `npm start` to serve the updated build. Restart the process after editing backend files. The production server serves only the compiled public website and the API.

## Local settings

Defaults work without an environment file. To use different settings, set the applicable variables in PowerShell **before** `npm start` or `npm run dev`.

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `5173` | Website and API port. Example: `$env:PORT = "5180"`. |
| `CAMPUS_TIME_ZONE` | Computer’s time zone | IANA time zone for the timetable. Example: `$env:CAMPUS_TIME_ZONE = "Asia/Kolkata"`. |
| `FACULTYFINDR_DB` | `data/facultyfindr.sqlite` | Alternative database file path. Set an absolute path to keep the database outside the source folder. |
| `ENABLE_DEMO` | `1` | Set to `0` to disable demo sign-in and expire existing sample-account sessions. Registered faculty accounts keep working. |

This edition listens on the loopback interface of the computer running it. All browsers connecting to that instance share its data. A separate installation has its own database. Registration is open and faculty IDs are self-entered. Institution-wide deployment would require a hosted server, HTTPS and a faculty verification policy.

## Source layout

| Path | Role |
| --- | --- |
| `server/index.js` | Starts the server, opens SQLite and mounts the API and website |
| `server/api.js` | HTTP routes, cookies, request limits and session checks |
| `server/store.js` | Database schema, seed data, passwords, sessions and atomic writes |
| `server/validation.js` | Faculty fields, photograph thumbnails and timetable validation |
| `server/static.js` | Serves the bundled website and client routes |
| `src/data/DirectoryContext.jsx` | Connects the React interface to the same-origin API |
| `src/data/facultyProfiles.js`, `campusTime.js` | Sample profiles, availability rules and campus clock |
| `src/`, `public/` | Editable React site, pixel-hand artwork, local fonts and other assets |
| `dist/` | Ready-built website used by `npm start` |

Public directory data is available at `GET /api/state`. The profile photo URL appears in each profile. Account actions use `POST /api/auth/signup`, `POST /api/auth/login`, and `POST /api/auth/logout`. Signed-in faculty edits use `PATCH /api/me/profile`, `POST /api/me/period`, and `POST /api/me/availability`.
