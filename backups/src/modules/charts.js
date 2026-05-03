let chartRegistry = [];

function clearCharts() {
    chartRegistry.forEach((chart) => chart.destroy());
    chartRegistry = [];
}

function makeBarChart(canvas, labels, values, label) {
    if (!canvas || !window.Chart) return;
    const chart = new window.Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label,
                    data: values,
                    borderRadius: 10,
                    backgroundColor: ["#8a795d", "#2d3a3a", "#c9b48e", "#566b6b", "#b89d6e", "#6f7f92"],
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: "#64748b", font: { size: 11 } },
                    grid: { color: "rgba(148,163,184,0.16)" }
                }
            }
        }
    });
    chartRegistry.push(chart);
}

function makeDoughnutChart(canvas, labels, values) {
    if (!canvas || !window.Chart) return;
    const chart = new window.Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [
                {
                    data: values,
                    backgroundColor: ["#2d3a3a", "#8a795d", "#d0b48a", "#94a3b8"],
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, color: "#64748b", font: { size: 11 } }
                }
            }
        }
    });
    chartRegistry.push(chart);
}

export function renderAnalyticsCharts(payload) {
    clearCharts();

    makeBarChart(
        document.getElementById("subjectAccuracyChart"),
        payload.subjectReport.map((item) => item.subject),
        payload.subjectReport.map((item) => item.accuracy),
        "Subject Accuracy"
    );

    makeBarChart(
        document.getElementById("weakAreaChart"),
        payload.weakAreas.map((item) => item.topic),
        payload.weakAreas.map((item) => item.accuracy),
        "Topic Accuracy"
    );

    makeBarChart(
        document.getElementById("decisionMetricsChart"),
        payload.decisionMetrics.map((item) => item.label),
        payload.decisionMetrics.map((item) => item.accuracy),
        "Decision Accuracy"
    );

    makeDoughnutChart(
        document.getElementById("mistakeMixChart"),
        payload.conceptualMetrics.map((item) => item.tag),
        payload.conceptualMetrics.map((item) => item.count)
    );

    makeBarChart(
        document.getElementById("difficultyMetricsChart"),
        payload.difficultyMetrics.map((item) => item.level),
        payload.difficultyMetrics.map((item) => item.accuracy),
        "Difficulty Accuracy"
    );

    makeBarChart(
        document.getElementById("sourcePerformanceChart"),
        payload.sourceReport.map((item) => item.source),
        payload.sourceReport.map((item) => item.accuracy),
        "Source Accuracy"
    );

    makeBarChart(
        document.getElementById("revisionBacklogChart"),
        payload.revisionBacklog.map((item) => item.label),
        payload.revisionBacklog.map((item) => item.count),
        "Revision Backlog"
    );

    makeBarChart(
        document.getElementById("incorrectTrendChart"),
        payload.incorrectTrend.map((item) => item.label),
        payload.incorrectTrend.map((item) => item.count),
        "Incorrect Trend"
    );
}
