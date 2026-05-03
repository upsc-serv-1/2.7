$path = "c:\Users\Dr. Yogesh\Pictures\g1\src\app.js"
$content = Get-Content $path -Raw

$newFunc = @"
function renderHomeLanding() {
    return \`
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
                    \${renderSuccessRoadmap()}
                </div>
                
                <p class="loop-line" style="margin-top: 64px; opacity: 0.7; font-weight: 600; letter-spacing: 0.05em;">Systematic Analysis → Contextual Study → Rigorous Practice → Smart Revision</p>
            </div>
        </section>
    \`;
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

    return \`
        <div class="roadmap-container">
            \${steps.map((step) => \`
                <div class="roadmap-step \${step.className}" data-roadmap-view="\${step.view}">
                    <div class="roadmap-icon-wrapper">
                        <span class="roadmap-icon">\${step.icon}</span>
                    </div>
                    <div class="roadmap-content">
                        <span class="roadmap-title">\${step.title}</span>
                        <span class="roadmap-desc">\${step.desc}</span>
                    </div>
                </div>
            \`).join("")}
        </div>
    \`;
}
"@

# Define the start and end tokens for replacement
$startToken = "function renderHomeLanding() {"
# We need to find the closing brace of the original function OR the corrupted block.
# I'll search for the next "function" keyword after the start token.

$startIndex = $content.IndexOf($startToken)
if ($startIndex -ge 0) {
    # Find the next function or end of the corrupted block
    $nextFuncIndex = $content.IndexOf("function", $startIndex + $startToken.Length)
    if ($nextFuncIndex -lt 0) {
        $nextFuncIndex = $content.Length
    }
    
    $before = $content.Substring(0, $startIndex)
    $after = $content.Substring($nextFuncIndex)
    
    $newContent = $before + $newFunc + "`n`n" + $after
    $newContent | Set-Content $path -NoNewline
    Write-Output "Successfully updated renderHomeLanding"
} else {
    Write-Error "Could not find start token"
}
