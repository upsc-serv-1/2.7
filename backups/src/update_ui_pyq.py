import os
import re

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Function to remove the old source scope sections
def clean_old_ui(html):
    pattern = r'<!-- NEW: Clean Source Scope Selector -->.*?</div>\s*` : ""}\s*` : ""}'
    # This is complex due to nested template literals. 
    # Let's try to find the specific blocks I saw earlier.
    
    # Actually, it's easier to find the specific block structure and replace with my new call.
    # Pattern: <!-- NEW: Clean Source Scope Selector --> followed by the div class="source-scope-section"
    
    old_section_pattern = re.compile(r'<!-- NEW: Clean Source Scope Selector -->.*?</div>\s*</div>', re.DOTALL)
    return old_section_pattern.sub('${renderSourceScopeToggle(state.practiceSourceFilter)}', html)

# 1. Update template literals in configurators
# I'll manually replace the specific lines identified earlier.

# Lines are around 4813, 4860, 4907.
# I will search for the specific markers and replace the inner content.

# 2. Add source selection modal
new_modal_func = """
function renderSourceSelectorModal() {
    if (!state.pyqSourceModalOpen) return "";
    
    const categories = getCategorizedPyqGroups();
    const isSelected = (group) => state.practiceSelectedPyqGroupFilters.includes(group);
    
    const renderGroupList = (groups, title, icon) => `
        <div class="source-group-tier">
            <div class="tier-head" style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">${icon}</span>
                <strong style="font-size: 1rem; color: var(--text);">${title}</strong>
            </div>
            <div class="stacked-chips" style="margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 8px;">
                ${groups.map(group => `
                    <button type="button" class="chip ${isSelected(group) ? "active-chip" : ""}" data-pyq-group="${group}" style="font-size: 0.8rem; padding: 6px 12px; border-radius: 8px;">
                        ${group}
                    </button>
                `).join("")}
                ${groups.length === 0 ? '<p class="muted" style="font-size: 0.8rem; width: 100%;">No sources found in this category.</p>' : ""}
            </div>
        </div>
    `;

    return `
        <div class="modal-backdrop" id="sourceModalBackdrop" style="display: flex; align-items: center; justify-content: center; z-index: 2000;">
            <div class="modal-panel" style="max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 32px; border-radius: 24px;">
                <div class="modal-head" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <p class="eyebrow">Advanced Filtering</p>
                        <h3>Select PYQ Sources</h3>
                    </div>
                    <button class="ghost-btn icon-btn" id="closeSourceModalBtn" type="button"><i class="fas fa-times"></i></button>
                </div>
                
                <div class="modal-body">
                    <p class="muted" style="margin-bottom: 24px; font-size: 0.9rem;">Refine your journey by selecting specific UPSC and State sources.</p>
                    
                    ${renderGroupList(categories.cse, "UPSC CSE Specialization", "🏆")}
                    <div class="dropdown-divider" style="margin: 20px 0; background: var(--line);"></div>
                    ${renderGroupList(categories.allied, "UPSC Allied Services", "🏛️")}
                    <div class="dropdown-divider" style="margin: 20px 0; background: var(--line);"></div>
                    ${renderGroupList(categories.others, "State PCS and Other Sources", "🗺️")}
                </div>
                
                <div class="modal-foot" style="margin-top: 32px; display: flex; gap: 12px;">
                    <button class="ghost-btn" id="clearSourceFiltersBtn" style="flex: 1; justify-content: center;">Reset Selection</button>
                    <button class="primary-btn" id="applySourceFiltersBtn" style="flex: 1; justify-content: center;">Apply & Close</button>
                </div>
            </div>
        </div>
    `;
}
"""

# Append modal function
content += "\n" + new_modal_func

# 3. Update bindGlobalEvents
# Add listeners for segmented control and the new modal actions
# Find bindGlobalEvents closing brace
# I'll inject at the end of the function body

bind_end_token = "// Use this to register generic top-level events"
# Wait, let's find the ACTUAL end of the function
# I'll search for "if (state.currentView === "syllabusTracker") bindTrackerEvents();" as a marker near the end

marker = 'if (state.currentView === "syllabusTracker") bindTrackerEvents();'
marker_index = content.find(marker)
if marker_index != -1:
    listener_code = """
    // Source Scope Segmented Control
    document.addEventListener("click", (e) => {
        const segment = e.target.closest(".segment");
        if (segment) {
            state.practiceSourceFilter = segment.dataset.scopeFilter;
            renderApp();
        }
    });

    // PYQ Source Modal Listeners
    document.addEventListener("click", (e) => {
        if (e.target.id === "openPyqSourceSelectorBtn") {
            state.pyqSourceModalOpen = true;
            renderApp();
        }
        if (e.target.id === "closeSourceModalBtn" || e.target.id === "sourceModalBackdrop" || e.target.id === "applySourceFiltersBtn") {
            state.pyqSourceModalOpen = false;
            renderApp();
        }
        if (e.target.id === "clearSourceFiltersBtn") {
            state.practiceSelectedPyqGroupFilters = [];
            renderApp();
        }
        
        const groupChip = e.target.closest("[data-pyq-group]");
        if (groupChip) {
            const group = groupChip.dataset.pyqGroup;
            const index = state.practiceSelectedPyqGroupFilters.indexOf(group);
            if (index === -1) {
                state.practiceSelectedPyqGroupFilters.push(group);
            } else {
                state.practiceSelectedPyqGroupFilters.splice(index, 1);
            }
            renderApp();
        }
    });

"""
    content = content[:marker_index] + listener_code + content[marker_index:]

# 4. Integrate modal into renderApp
# Find "const appShell = `..." in renderApp and append ${renderSourceSelectorModal()}
render_app_marker = "const appShell = `"
shell_index = content.find(render_app_marker)
if shell_index != -1:
    # Find the end of the template literal
    # Need to find the match for `
    # It's usually many lines later
    shell_close = content.find("`;", shell_index)
    if shell_close != -1:
        content = content[:shell_close] + "${renderSourceSelectorModal()}\n" + content[shell_close:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected Modal logic and events into app.js")
# Note: I still need to clean up the old UI blocks, doing that in a separate replacement step for safety.
