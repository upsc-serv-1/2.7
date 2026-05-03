import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update state initialization
state_line = "const state = {"
state_index = content.find(state_line)
if state_index != -1:
    new_state_props = """    practiceSourceFilter: "all",
    practiceSelectedPyqGroupFilters: [],
"""
    # Insert at start of state
    content = content[:state_index + len(state_line)] + "\n" + new_state_props + content[state_index + len(state_line):]

# 2. Add helper function to categorize groups
helper_funcs = """
function getCategorizedPyqGroups() {
    const allTests = accessibleTests();
    const groupsFound = new Set();
    
    allTests.forEach(test => {
        if (!test.questions) return;
        test.questions.forEach(q => {
            const hydrated = hydrateQuestionRecord(q, test);
            const group = hydrated.pyqMeta?.group || hydrated.source?.group;
            if (group) groupsFound.add(group);
        });
    });
    
    const categories = {
        cse: [],
        allied: [],
        others: []
    };
    
    Array.from(groupsFound).sort().forEach(group => {
        const norm = group.toLowerCase();
        if (norm === "upsc cse" || norm.includes("civil services")) {
            categories.cse.push(group);
        } else if (norm.includes("upsc")) {
            categories.allied.push(group);
        } else {
            categories.others.push(group);
        }
    });
    
    return categories;
}

function renderSourceScopeToggle(currentValue, idPrefix = "") {
    return `
        <div class="source-scope-section" style="margin-top: 16px; padding: 20px; background: var(--surface-strong); border-radius: 16px; border: 1px solid var(--line); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                <span style="font-weight: 700; font-size: 0.95rem; color: var(--text); letter-spacing: 0.02em;">Digital Source Filter</span>
                <span class="muted" style="font-size: 0.8rem;">
                    ${currentValue === "all" ? "Whole database" : currentValue === "pyq" ? "Authentic PYQs" : "Practice Mock Bank"}
                </span>
            </div>
            
            <div class="segmented-control" style="display: flex; background: var(--surface); padding: 4px; border-radius: 12px; border: 1px solid var(--line); margin-bottom: 16px;">
                <button type="button" class="segment ${currentValue === "all" ? "active" : ""}" data-scope-filter="all" style="flex: 1; padding: 10px; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease;">All Questions</button>
                <button type="button" class="segment ${currentValue === "pyq" ? "active" : ""}" data-scope-filter="pyq" style="flex: 1; padding: 10px; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease;">PYQ Only</button>
                <button type="button" class="segment ${currentValue === "nonPyq" ? "active" : ""}" data-scope-filter="nonPyq" style="flex: 1; padding: 10px; border: none; background: transparent; cursor: pointer; border-radius: 8px; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease;">Non-PYQ Only</button>
            </div>

            ${currentValue === "pyq" ? `
                <button type="button" class="primary-btn small" id="openPyqSourceSelectorBtn" style="width: 100%; justify-content: center; gap: 8px; border-radius: 10px; padding: 12px;">
                    <i class="fas fa-filter"></i>
                    ${state.practiceSelectedPyqGroupFilters.length === 0 ? "Select PYQ Sources (Total Access)" : `${state.practiceSelectedPyqGroupFilters.length} Groups Selected`}
                </button>
            ` : ""}
        </div>
    `;
}
"""

# Find where to insert helpers - before renderApp maybe
insert_point = content.find("function renderApp()")
if insert_point != -1:
    content = content[:insert_point] + helper_funcs + "\n" + content[insert_point:]

# 3. Update questionMatchesSourceFilters
# Find function questionMatchesSourceFilters(question = {}) {
start_match = "function questionMatchesSourceFilters(question = {}) {"
start_f = content.find(start_match)
if start_f != -1:
    end_f = content.find("}", start_f)
    new_match_logic = """function questionMatchesSourceFilters(question = {}) {
    if (state.practiceSourceFilter === "all") return true;
    const hydrated = hydrateQuestionRecord(question);
    const isPyq = hydrated.isPyq;
    
    if (state.practiceSourceFilter === "pyq") {
        if (!isPyq) return false;
        if (state.practiceSelectedPyqGroupFilters.length === 0) return true;
        const group = hydrated.pyqMeta?.group || hydrated.source?.group || "";
        return state.practiceSelectedPyqGroupFilters.includes(group);
    }
    
    if (state.practiceSourceFilter === "nonPyq") {
        return !isPyq;
    }
    return true;
}"""
    # Replace function
    # Need to find the REAL end of the function (closing brace)
    # This is simple for this function as it doesn't have nested braces in a complex way
    content = content[:start_f] + new_match_logic + content[end_f + 1:]

# Save intermediate for logic updates
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Logic and Core Filters in app.js")
