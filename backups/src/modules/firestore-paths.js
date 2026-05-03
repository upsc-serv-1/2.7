import { appConfig } from "../config/app-config.js";

export function publicCollectionPath(name) {
    return ["artifacts", appConfig.appId, "public", "shared", name];
}

export function userCollectionPath(uid, name) {
    return ["artifacts", appConfig.appId, "users", uid, name];
}

export function adminCollectionPath(name) {
    return ["artifacts", appConfig.appId, "admin", "shared", name];
}

export function questionStateDocId(questionId) {
    return questionId;
}

export function testAttemptDocId(testId, submittedAt) {
    return `${testId}__${submittedAt}`;
}
