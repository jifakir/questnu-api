import {
  ALL_USERS_TOPIC,
  audienceFilter,
  audienceTopics,
  cleanIds,
} from './audience';

describe('audienceTopics', () => {
  it('sends to everyone when nothing is picked', () => {
    expect(audienceTopics({ targetYears: [], targetDepartments: [] })).toEqual([
      ALL_USERS_TOPIC,
    ]);
  });

  it('sends to year topics when only years are picked', () => {
    expect(
      audienceTopics({ targetYears: ['2', '3'], targetDepartments: [] }),
    ).toEqual(['year-2', 'year-3']);
  });

  it('sends to department topics when only departments are picked', () => {
    expect(
      audienceTopics({ targetYears: [], targetDepartments: ['accounting'] }),
    ).toEqual(['dept-accounting']);
  });

  it('sends to each year × department pair when both are picked', () => {
    expect(
      audienceTopics({
        targetYears: ['2'],
        targetDepartments: ['accounting', 'bangla'],
      }),
    ).toEqual(['yd-2-accounting', 'yd-2-bangla']);
  });

  it('replaces characters FCM does not allow', () => {
    expect(
      audienceTopics({ targetYears: [], targetDepartments: ['a b/c'] }),
    ).toEqual(['dept-a_b_c']);
  });
});

describe('cleanIds', () => {
  it('trims, drops blanks and duplicates', () => {
    expect(cleanIds([' 2', '2', '', '3 '])).toEqual(['2', '3']);
    expect(cleanIds(undefined)).toEqual([]);
  });
});

describe('audienceFilter', () => {
  it("matches untargeted notices and the student's own year", () => {
    expect(audienceFilter('2', undefined)).toEqual({
      $and: [
        {
          $or: [
            { targetYears: { $exists: false } },
            { targetYears: { $size: 0 } },
            { targetYears: '2' },
          ],
        },
        {
          $or: [
            { targetDepartments: { $exists: false } },
            { targetDepartments: { $size: 0 } },
          ],
        },
      ],
    });
  });
});
