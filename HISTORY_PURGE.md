# History purge — remove the committed database from git history

## Working-tree removal (do this when you apply the pack)

The pack itself cannot delete a tracked file. After extracting it, run:

```bash
git rm --cached data/sweetcravings.db
rm -f data/sweetcravings.db
```

From then on the file is untracked and ignored, and the app re-creates a
fresh empty database (seeded with the menu) on its next start.

## Why the history purge is still needed

The file `data/sweetcravings.db` was committed in the first commit of this
public repo. It contains a real test order with a customer's name, phone
number and address. Deleting the file in a new commit is NOT enough: the
old commit still holds the file, and anyone can check it out.

The database file is now untracked (`.gitignore` covers `data/*.db`), so
no future commit will include it. But the history still needs purging.

## Do this only when you are ready — it rewrites history

- Everyone who cloned the repo must re-clone afterwards; old clones still
  contain the file.
- You will need to force-push. Make sure no one else has pushed new work
  on top of the old history first — if they have, coordinate with them.

## Commands (run in the repo, one at a time)

```bash
# 1. Make a backup copy of the repo, just in case.
cp -r sweetcravings sweetcravings-backup-before-purge

# 2. Remove the database file from every commit in history.
#    (git filter-repo is the supported tool; install it first if needed:
#     pip install git-filter-repo)
git filter-repo --path data/sweetcravings.db --invert-paths --force

# 3. Check that the file is really gone from history.
git log --all --oneline -- data/sweetcravings.db
#    ^ This should print nothing.

# 4. Push the rewritten history. This is the destructive step.
git push origin --force --all
git push origin --force --tags
```

If you do not have `git filter-repo`, the older built-in alternative is:

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch data/sweetcravings.db' \
  --prune-empty --tag-name-filter cat -- --all
```

`filter-branch` is slower and deprecated; prefer `filter-repo` when you can.

## After the purge

- Confirm on GitHub that the file no longer appears in any commit.
- Tell the test customer (the one whose details were in the file) that
  their order details were briefly in a public repo and have been removed.
- Set the shop's real WhatsApp / bKash / Nagad numbers in Admin Settings
  — the site now ships with those fields blank on purpose, so no
  placeholder number is ever shown to customers.
- Set `ADMIN_PASSWORD` in your hosting environment (never in git) before
  anyone uses `/admin`.
