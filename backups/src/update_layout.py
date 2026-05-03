import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

roadmap_code = """function renderSuccessRoadmap() {
    const steps = [
        { id: "syllabusTracker", title: "Tracker", desc: "Track readiness for **Prelims**, **Mains**, and **Optionals** based on **Official UPSC Syllabus** and **Micro-Topic** modes.", icon: "📑", view: "syllabusTracker", className: "step-tracker" },
        { id: "study", title: "Study", desc: "Access **Topic-Wise PYQs/Q-Bank**. Search **Keywords** across **Vast Database**.", icon: "📖", view: "study", className: "step-study" },
        { id: "folders", title: "Tags", desc: "Classify questions with **Custom Tags**, revise them in **Groups**, and download with **One Click**.", icon: "🏷️", view: "folders", className: "step-tags" },
        { id: "notes", title: "Notes", desc: "**Highlight Key Explanations** and instantly they get **Saved to Your Notes**, which you can **Download to Revise**.", icon: "📓", view: "notes", className: "step-notes" },
        { id: "pyqAnalysis", title: "PYQ Analysis", desc: "Analyze **PYQ Trends**, **Hot Topics**, **Subject-wise/Year-wise Heat Maps**, and **Detailed Section Analysis**.", icon: "📊", view: "pyqAnalysis", className: "step-pyq-analysis" },
        { id: "practice", title: "Practice", desc: "Solve **Full-Length**, **Topic-Wise**, or **Custom Tests** with **Time-Bound Practice Modes** for exam simulation.", icon: "✍️", view: "practice", className: "step-practice" },
        { id: "review", title: "Review", desc: "Perform **Detailed Post-Test Reviews**, analyze **Guessing Accuracy**, and track **Performance Records**.", icon: "🧐", view: "review", className: "step-review" },
        { id: "analytics", title: "Analytics", desc: "Identify **Weak Areas** and patterns of **Frequent Incorrect Answers** through **Detailed Analytical Reports**.", icon: "🎯", view: "analytics", className: "step-analytics" },
        { id: "flashcards", title: "Revise", desc: "Master concepts using **Spaced Repetition**, **Flashcards**, and revision of **Incorrectly Attempted Questions**.", icon: "🧠", view: "flashcards", className: "step-revise" }
    ];

    // Helper to format bold markdown-like text to HTML
    const formatDesc = (text) => text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');

    return `
        <div class="roadmap-container grid-4-1-4">
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
        <div class="roadmap-detail-caption" style="margin-top: 56px; font-size: 1.05rem; color: var(--muted); font-weight: 500; max-width: 800px; margin-left: auto; margin-right: auto; line-height: 1.6; opacity: 0.9;">
            Instantly review mistakes from tests with detailed analysis. Identify weak areas by tracking frequent incorrect patterns and focus your revision where it matters most.
        </div>
    `;
}"""

# Update renderSuccessRoadmap
start_token = "function renderSuccessRoadmap() {"
start_index = content.find(start_token)
if start_index != -1:
    end_token = "function renderRunnerPaper"
    end_index = content.find(end_token, start_index)
    if end_index != -1:
        new_content = content[:start_index] + roadmap_code + "\n\n" + content[end_index:]
        
        # Also clean up Hero H1 rendering for centering and one-line
        # Find h1 in renderHomeLanding
        h1_start_token = "<h1"
        h1_index = new_content.find(h1_start_token)
        if h1_index != -1:
            h1_end_token = "</h1>"
            h1_end_index = new_content.find(h1_end_token, h1_index)
            if h1_end_index != -1:
                # Replace with more robust structure
                new_h1 = """<h1 style="font-size: clamp(2.5rem, 6vw, 4.2rem); margin-bottom: 32px; line-height: 1.1; font-family: 'Playfair Display', serif; font-weight: 800; color: var(--accent-strong); width: 100%; text-align: center;">
                    <span style="display: block; white-space: nowrap;">Transform your Preparation.</span>
                    <span class="hero-accent typewriter-hero" style="display: block; margin-top: 12px; font-size: 0.7em; opacity: 0.9;">Master the UPSC Syllabus systematically.</span>
                </h1>"""
                new_content = new_content[:h1_index] + new_h1 + new_content[h1_end_index + len(h1_end_token):]

        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated Roadmap order and Hero H1 structure")
else:
    print("Error: Could not update app.js")
