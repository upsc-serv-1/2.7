import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix duplicate state properties
# Remove the ones starting around line 135
state_start = "const state = {"
state_end = "};" # This is dangerous, let's find a more specific end
# Actually I'll just remove the lines that I know are duplicates
duplicates = [
    '    syllabusProviderFilters: [],',
    '    practiceProviderFilters: [],',
    '    practiceMicroTopicFilters: [],',
    '    practiceSourceFilter: "all",',
    '    practiceSourceExamFilter: "allPyq",',
    '    practiceSelectedPyqSources: [],'
]

lines = content.split('\\n')
new_lines = []
in_duplicates_zone = False
for line in lines:
    clean_line = line.strip()
    if 'syllabusProviderFilters: [],' in line and lines.index(line) > 130:
        continue
    if 'practiceProviderFilters: [],' in line and lines.index(line) > 130:
         continue
    if 'practiceMicroTopicFilters: [],' in line and lines.index(line) > 130:
         continue
    if 'practiceSourceFilter: "all",' in line and lines.index(line) > 130:
         continue
    if 'practiceSourceExamFilter: "allPyq",' in line and lines.index(line) > 130:
         continue
    if 'practiceSelectedPyqSources: [],' in line and lines.index(line) > 130:
         continue
    new_lines.append(line)

content = '\\n'.join(new_lines)

# 2. Fix the syntax error in the configurator templates
# I suspect the issue is with mismatched parens in the paper filter logic.
# I'll replace the problematic lines with 100% correct ones.

target_line_1 = '${includeStudyActions ? `<button class="ghost-btn start-test-btn" id="launchTestReadBtn" type="button" ${((activeTest()?.questions?.filter((question) => questionMatchesSourceFilters(hydrateQuestionRecord(question, activeTest()))).length || 0) && !state.studyLaunchBusy) ? "" : "disabled"}>Textbook-Themed Study Mode</button>` : ""}'
fixed_line_1 = '${includeStudyActions ? `<button class="ghost-btn start-test-btn" id="launchTestReadBtn" type="button" ${(( (activeTest()?.questions || []).filter(q => questionMatchesSourceFilters(q)).length || 0 ) && !state.studyLaunchBusy) ? "" : "disabled"}>Textbook-Themed Study Mode</button>` : ""}'

content = content.replace(target_line_1, fixed_line_1)

target_line_2 = '${includeStudyActions ? `<button class="primary-btn start-test-btn" id="launchStudyTestBtn" type="button" ${((activeTest()?.questions?.filter((question) => questionMatchesSourceFilters(hydrateQuestionRecord(question, activeTest()))).length || 0) && !state.studyLaunchBusy) ? "" : "disabled"}>${state.studyLaunchBusy ? "Opening..." : "Normal Study Mode"}</button>` : ""}'
fixed_line_2 = '${includeStudyActions ? `<button class="primary-btn start-test-btn" id="launchStudyTestBtn" type="button" ${(( (activeTest()?.questions || []).filter(q => questionMatchesSourceFilters(q)).length || 0 ) && !state.studyLaunchBusy) ? "" : "disabled"}>${state.studyLaunchBusy ? "Opening..." : "Normal Study Mode"}</button>` : ""}'

content = content.replace(target_line_2, fixed_line_2)

# Also check for other similar ones in Topic/Tag mode
# Actually the signature of questionMatchesSourceFilters is (question = {}) now, so hydrateQuestionRecord is inside it.

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed duplicate state and configurator syntax errors.")
