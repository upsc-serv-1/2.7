import os

path = r"c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

roadmap_code = """function renderHomeLanding() {
    return `
        <section class="hero-panel">
            <div class="hero-noise"></div>
            <div class="hero-glow hero-glow-one"></div>
            <div class="hero-glow hero-glow-two"></div>
            <div class="hero-main" style="max-width: 1000px; margin: 0 auto; text-align: center; padding: 60px 20px;">
                <p class="eyebrow" style="letter-spacing: 0.3em; margin-bottom: 24px;">The Ultimate UPSC Preparation Journey</p>
                <h1 class="typewriter-hero" style="font-size: clamp(2.5rem, 6vw, 4.2rem); margin-bottom: 32px; line-height: 1.1; font-family: 'Playfair Display', serif; font-weight: 800; color: var(--accent-strong);">
                    Transform your Preparation.
                    <span class="hero-accent" style="display: block; margin-top: 12px; font-size: 0.7em; opacity: 0.9;">Master the UPSC Syllabus systematically.</span>
                </h1>
                <p class="hero-text" style="font-size: 1.25rem; max-width: 850px; margin: 0 auto 64px; opacity: 0.9; line-height: 1.6; color: var(--muted);">
                    UPSC Vault is not just a question bank. It is a full-cycle mastery system designed to move you from analysis to exam-day excellence.
                </p>
                
                <div class="success-roadmap-section">
                    ${renderSuccessRoadmap()}
                </div>
                
                <div class="loop-line-container" style="margin-top: 80px; padding-top: 40px; border-top: 1px solid var(--line); max-width: 600px; margin-left: auto; margin-right: auto;">
                    <p class="loop-line" style="opacity: 0.8; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.8rem; color: var(--accent);">
                        Analyze → Study → Practice → Revise → Achieve
                    </p>
                </div>
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
                        <span class="roadmap-title" style="font-family: 'Inter', sans-serif;">${step.title}</span>
                        <span class="roadmap-desc">${step.desc}</span>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}\n\n"""

start_token = "function renderHomeLanding() {"
end_token = "function renderRunnerPaper(test, attempt) {"

start_index = content.find(start_token)
if start_index != -1:
    end_index = content.find(end_token, start_index)
    if end_index != -1:
        new_content = content[:start_index] + roadmap_code + content[end_index:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully cleaned and updated app.js")
    else:
        print("Error: Could not find renderRunnerPaper")
else:
    print("Error: Could not find renderHomeLanding")
