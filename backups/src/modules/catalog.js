export function extractSectionsForSubject(taxonomy, subject) {
    return taxonomy
        .filter((item) => item.subject === subject && item.sectionGroup)
        .map((item) => item.sectionGroup);
}

export function filterTests(tests, filters) {
    return tests.filter((test) => {
        if (filters.provider && test.provider !== filters.provider) return false;
        if (filters.subject && test.subject !== filters.subject) return false;
        if (filters.sectionGroup && filters.sectionGroup !== "All" && test.sectionGroup !== filters.sectionGroup) return false;
        return true;
    });
}
