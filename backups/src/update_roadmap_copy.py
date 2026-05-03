import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

roadmap_funcs = """function renderSuccessRoadmap() {
    const steps = [
        { id: "analyze", title: "Analyze", desc: "PYQ Trends & Patterns", icon: "📊", view: "pyqAnalysis", className: "step-analyze" },
        { id: "study", title: "Study", desc: "Targeted Syllabus", icon: "📖", view: "study", className: "step-study" },
        { id: "practice", title: "Practice", desc: "Test Mechanism", icon: "💻", view: "practice", className: "step-practice" },
        { id: "revise", title: "Revise", desc: "Spaced Repetition & Tags", icon: "🧠", view: "flashcards", className: "step-revise" },
        { id: "improve", title: "Improve", desc: "Analysis & Weak Areas", icon: "🎯", view: "review", className: "step-improve" },
        { id: "excel", title: "Excel", desc: "Success & Mastery", icon: "🏆", view: "analytics", className: "step-excel" }
    ];

    return `
        <div class="roadmap-container">
            ${steps.map((step) => `
                <div class="roadmap-step ${step.className}" data-roadmap-view="${step.view}">
                    <div class="roadmap-icon-wrapper">
                        <span class="roadmap-icon">${step.icon}</span>
                    </div>
                    <div class="roadmap-content">
                        <span class="roadmap-title">${step.title}</span>
                        <span class="roadmap-desc" style="padding: 0 4px; line-height: 1.25;">${step.desc}</span>
                    </div>
                </div>
            `).join("")}
        </div>
        <div class="roadmap-detail-caption" style="margin-top: 32px; font-size: 1rem; color: var(--muted); font-weight: 500; max-width: 800px; margin-left: auto; margin-right: auto; line-height: 1.6; opacity: 0.85;">
            Instantly review mistakes from tests with detailed analysis. Identify weak areas by tracking frequent incorrect patterns and focus your revision where it matters most.
        </div>
    `;
}"""

start_token = "function renderSuccessRoadmap() {"
end_token = "function renderLibraryEmptyState()" # This was the end token I used before or similar

# Actually, in the current app.js, renderSuccessRoadmap is just before renderLibraryEmptyState
# because I used the cleanup script to put it there.

start_index = content.find(start_token)
if start_index != -1:
    # Find the next function or end of the file part
    end_index = content.find("function", start_index + len(start_token))
    if end_index == -1:
        end_index = len(content)
        
    new_content = content[:start_index] + roadmap_funcs + "\n\n" + content[end_index:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated renderSuccessRoadmap with new copy")
else:
    print("Error: Could not find start token")
