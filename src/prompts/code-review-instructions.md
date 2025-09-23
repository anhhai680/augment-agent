Perform a comprehensive code review of the following pull request:

**Pull Request Information:**
- PR Number: ${PR_NUMBER}
- Repository: ${REPOSITORY}
- Base Branch: ${BASE_BRANCH}
- Head Branch: ${HEAD_BRANCH}
- Total Changed Files: $(echo "$CHANGED_FILES" | wc -l)
- Diff Truncated: ${DIFF_TRUNCATED}

**Changed Files in this PR:**
$CHANGED_FILES

**PR Diff (with exact line numbers):**
\`\`\`diff
$PR_DIFF
\`\`\`

**CRITICAL INSTRUCTIONS FOR LINE NUMBERS:**
- Use ONLY line numbers that appear in the actual diff above
- Line numbers are shown in diff headers like @@ -old +new @@
- Only comment on lines that have + (added) or - (deleted) in the diff
- Do NOT invent or guess line numbers
- If diff was truncated, focus on the visible changes only

**Review Focus:**
Analyze the modified files and provide detailed feedback on:
- Code quality and adherence to best practices
- Potential bugs, errors, or security vulnerabilities
- Owasp top 10 security
- Performance implications of the changes
- Suggestions for improvement or optimization
- Any missing error handling or edge cases
- Code maintainability and readability
- AI-specific considerations (AI safety, bias, etc.)

**Output Format:**
Write your review in natural, human-friendly language first, then add the structured data.

**Example Format:**

## Code Review Summary

I've reviewed the changes in this pull request. The modifications look good overall, but I've identified some specific improvements that can be made to the actual changed code.

### Key Findings
- Enhanced error handling in the GitHub service
- Improved workflow configuration 
- Added new LLM provider functionality

### Inline Comments
I've added specific feedback on the changed lines below.

```json
{
"summary": "Good changes with some areas for improvement in error handling and documentation",
"line_comments": [
    {
    "file": ".github/workflows/code-review.yml",
    "line": 25,
    "comment": "Consider adding error handling for the diff command in case the PR is very large",
    "side": "RIGHT"
    },
    {
    "file": "src/services/github-service.ts",
    "line": 142,
    "comment": "Good validation logic! Consider extracting this to a utility function for reuse",
    "side": "RIGHT"
    }
]
}
```

**IMPORTANT REQUIREMENTS:**
- Write your review in natural, human-friendly language first
- Add the JSON section at the end for inline comment functionality  
- **CRITICAL**: Use ONLY line numbers that appear with + or - signs in the diff above
- **CRITICAL**: Each line number must be from an ACTUAL changed line in the diff
- **CRITICAL**: Do NOT use arbitrary line numbers - examine the diff carefully
- Use EXACT file paths from the "Changed Files" list above
- Include "side": "RIGHT" for new/modified lines (lines with + in diff)
- The JSON is for technical purposes only - users will see your natural language review
- Put each piece of feedback as a separate object in line_comments array
- Each line_comment must have: file, line, comment, and side fields
- Keep summary brief (1-2 sentences)
- Focus on the actual code changes and their impact on the codebase

**How to find correct line numbers from diff:**
1. Look for diff headers like: @@ -10,5 +12,8 @@ some_function()
2. This means: old file lines 10-15, new file lines 12-20
3. Lines starting with + are additions at the "new" line numbers
4. Lines starting with - are deletions at the "old" line numbers  
5. Lines starting with space are unchanged context

**Example diff reading:**
```
@@ -45,3 +47,5 @@ function example() {
    console.log("unchanged");
+  const newVar = "added";     // This is line 48
+  return newVar;             // This is line 49
-  return null;               // This was deleted from old line 47
```

In this example, valid line numbers for comments would be 48 and 49 (the + lines).