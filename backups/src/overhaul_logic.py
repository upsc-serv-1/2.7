import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

roadmap_code = """function renderSuccessRoadmap() {
    const steps = [
        { id: "analyze", title: "Analyze", desc: "Analyze **PYQ Trends**, **Hot Topics**, **Subject-wise/Year-wise Heat Maps**, and **Detailed Section Analysis**.", icon: "📊", view: "pyqAnalysis", className: "step-analyze" },
        { id: "syllabusTracker", title: "Tracker", desc: "Track readiness for **Prelims**, **Mains**, and **Optionals** based on **Official UPSC Syllabus** and **Micro-Topic** modes.", icon: "📑", view: "syllabusTracker", className: "step-tracker" },
        { id: "study", title: "Study", desc: "Access **Topic-Wise PYQs/Q-Bank**. Search **Keywords** across **Vast Database**.", icon: "📖", view: "study", className: "step-study" },
        { id: "practice", title: "Practice", desc: "Solve **Full-Length**, **Topic-Wise**, or **Custom Tests** with **Time-Bound Practice Modes** for exam simulation.", icon: "✍️", view: "practice", className: "step-practice" },
        { id: "review", title: "Review", desc: "Perform **Detailed Post-Test Reviews**, analyze **Guessing Accuracy**, and track **Performance Records**.", icon: "🧐", view: "review", className: "step-review" },
        { id: "analytics", title: "Analytics", desc: "Identify **Weak Areas** and patterns of **Frequent Incorrect Answers** through **Detailed Analytical Reports**.", icon: "🎯", view: "analytics", className: "step-analytics" },
        { id: "flashcards", title: "Revise", desc: "Master concepts using **Spaced Repetition**, **Flashcards**, and revision of **Incorrectly Attempted Questions**.", icon: "🧠", view: "flashcards", className: "step-revise" },
        { id: "folders", title: "Tags", desc: "Classify questions with **Custom Tags**, revise them in **Groups**, and download with **One Click**.", icon: "🏷️", view: "folders", className: "step-tags" },
        { id: "notes", title: "Notes", desc: "**Highlight Key Explanations** and instantly they get **Saved to Your Notes**, which you can **Download to Revise**.", icon: "📓", view: "notes", className: "step-notes" }
    ];

    // Helper to format bold markdown-like text to HTML
    const formatDesc = (text) => text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');

    return `
        <div class="roadmap-container">
            ${steps.map((step) => `
                <div class="roadmap-step ${step.className}" data-roadmap-view="${step.view}">
                    <div class="roadmap-icon-wrapper">
                        <span class="roadmap-icon">${step.icon}</span>
                    </div>
                    <div class="roadmap-content">
                        <span class="roadmap-title">${step.title}</span>
                        <p class="roadmap-desc" style="padding: 0 4px; line-height: 1.4;">${formatDesc(step.desc)}</p>
                    </div>
                </div>
            `).join("")}
        </div>
        <div class="roadmap-detail-caption" style="margin-top: 48px; font-size: 1.05rem; color: var(--muted); font-weight: 500; max-width: 800px; margin-left: auto; margin-right: auto; line-height: 1.6; opacity: 0.9;">
            Instantly review mistakes from tests with detailed analysis. Identify weak areas by tracking frequent incorrect patterns and focus your revision where it matters most.
        </div>
    `;
}"""

# Find the start and end of the function
start_token = "function renderSuccessRoadmap() {"
start_index = content.find(start_token)
if start_index != -1:
    end_token = "function renderRunnerPaper"
    end_index = content.find(end_token, start_index)
    if end_index != -1:
        new_content = content[:start_index] + roadmap_code + "\n\n" + content[end_index:]
        
        # Also inject event listener for profile toggle in bindGlobalEvents
        # Find bindGlobalEvents
        bind_token = "function bindGlobalEvents() {"
        bind_index = new_content.find(bind_token)
        if bind_index != -1:
            listener_code = """    // Profile Dropdown Toggle
    document.getElementById("profileAvatarBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        state.profileDropdownOpen = !state.profileDropdownOpen;
        state.quietRender = true;
        renderApp();
    });
    // Close dropdown on outside click
    document.addEventListener("click", () => {
        if (state.profileDropdownOpen) {
            state.profileDropdownOpen = false;
            state.quietRender = true;
            renderApp();
        }
    });

"""
            new_content = new_content[:bind_index + len(bind_token)] + "\n" + listener_code + new_content[bind_index + len(bind_token):]
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully updated renderSuccessRoadmap and bindGlobalEvents")
        else:
            print("Error: Could not find bindGlobalEvents")
    else:
        print("Error: Could not find renderRunnerPaper")
else:
    print("Error: Could not find renderSuccessRoadmap")
