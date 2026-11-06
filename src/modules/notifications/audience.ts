/**
 * Who a notification is for. Empty lists mean "everyone" on that axis, so a
 * notification with no years and no departments goes to all users.
 *
 * Each app install subscribes to push topics for its student's year and
 * department (see `PushNotifications.syncAudience` in the app). Keep the
 * topic names below in sync with the app.
 */

/** FCM topic every QuestNU app install subscribes to. */
export const ALL_USERS_TOPIC = 'all-users';

/** Most topics one push may target (FCM `sendEach` takes up to 500 messages). */
export const MAX_AUDIENCE_TOPICS = 500;

export interface Audience {
  targetYears: string[];
  targetDepartments: string[];
}

/** FCM topic names allow only `[a-zA-Z0-9-_.~%]`. */
function topicPart(id: string) {
  return id.trim().replace(/[^a-zA-Z0-9\-_.~%]/g, '_');
}

export const yearTopic = (year: string) => `year-${topicPart(year)}`;
export const departmentTopic = (dept: string) => `dept-${topicPart(dept)}`;
export const yearDepartmentTopic = (year: string, dept: string) =>
  `yd-${topicPart(year)}-${topicPart(dept)}`;

/**
 * Topics to send a push to. A device has one year and one department, so it
 * is in at most one of these topics and never gets the push twice.
 */
export function audienceTopics({
  targetYears: years,
  targetDepartments: depts,
}: Audience): string[] {
  if (years.length === 0 && depts.length === 0) return [ALL_USERS_TOPIC];
  if (depts.length === 0) return years.map(yearTopic);
  if (years.length === 0) return depts.map(departmentTopic);
  return years.flatMap((y) => depts.map((d) => yearDepartmentTopic(y, d)));
}

/** Trimmed, de-duplicated ids. */
export function cleanIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

/**
 * Mongo filter for notifications a student of [year] / [department] may see.
 * A student with no year (or department) only sees notifications that do not
 * target years (or departments).
 */
export function audienceFilter(year?: string, department?: string) {
  const axis = (field: string, value?: string) => {
    const open = [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }];
    return { $or: value ? [...open, { [field]: value }] : open };
  };
  return {
    $and: [
      axis('targetYears', year?.trim()),
      axis('targetDepartments', department?.trim()),
    ],
  };
}
