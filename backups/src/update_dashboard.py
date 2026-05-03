import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

roadmap_funcs = """function renderHomeLanding() {
    return `
        <section class="hero-panel">
            <div class="hero-noise"></div>
            <div class="hero-glow hero-glow-one"></div>
            <div class="hero-glow hero-glow-two"></div>
            <div class="hero-main" style="max-width: 900px; margin: 0 auto; text-align: center;">
                <p class="eyebrow">The Ultimate UPSC Preparation Journey</p>
                <h2 class="typewriter-hero" style="font-size: clamp(2.2rem, 5vw, 3.5rem); margin-bottom: 24px; line-height: 1.2;">Transform your Preparation.
                    <span class="hero-accent" style="display: block; margin-top: 8px;">Master the UPSC Syllabus systematically.</span>
                </h2>
                <p class="hero-text" style="font-size: 1.15rem; max-width: 800px; margin: 0 auto 48px; opacity: 0.9;">UPSC Vault is not just a question bank. It is a full-cycle mastery system designed to move you from analysis to exam-day excellence.</p>
                
                <div class="success-roadmap-section">
                    ${renderSuccessRoadmap()}
                </div>
                
                <p class="loop-line" style="margin-top: 64px; opacity: 0.7; font-weight: 600; letter-spacing: 0.05em;">Systematic Analysis → Contextual Study → Rigorous Practice → Smart Revision</p>
            </div>
        </section>
    `;
}

function renderSuccessRoadmap() {
    const steps = [
        { id: "analyze", title: "Analyze", desc: "PYQ Trends", icon: "📊", view: "pyqAnalysis", className: "step-analyze" },
        { id: "study", title: "Study", desc: "Targeted Content", icon: "📖", view: "study", className: "step-study" },
        { id: "practice", title: "Practice", desc: "Test Mechanism", icon: "💻", view: "practice", className: "step-practice" },
        { id: "revise", title: "Revise", desc: "Spaced Repetition", icon: "🧠", view: "flashcards", className: "step-revise" },
        { id: "improve", title: "Improve", desc: "Incorrect Patterns", icon: "🎯", view: "review", className: "step-improve" },
        { id: "excel", title: "Excel", desc: "Mastery & Success", icon: "🏆", view: "analytics", className: "step-excel" }
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
                        <span class="roadmap-desc">${step.desc}</span>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}"""

start_token = "function renderHomeLanding() {"
end_token = "function renderLibraryEmptyState()"

start_index = content.find(start_token)
if start_index != -1:
    end_index = content.find(end_token, start_index)
    if end_index != -1:
        new_content = content[:start_index] + roadmap_funcs + "\n\n" + content[end_index:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated renderHomeLanding")
    else:
        print("Error: Could not find end token")
else:
    print("Error: Could not find start token")
