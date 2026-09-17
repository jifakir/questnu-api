export type NamedSeed = {
  slug: string;
  name: string;
  nameBn?: string;
  sortOrder: number;
};

export type YearSeed = {
  slug: string;
  label: string;
  labelBn: string;
  sortOrder: number;
};

/** Mirrors the Flutter bundled seed so the admin portal can load the same starter catalog. */
export const STARTER_DEPARTMENTS: NamedSeed[] = [
  { slug: 'accounting', name: 'Accounting', nameBn: 'হিসাববিজ্ঞান', sortOrder: 0 },
  { slug: 'anthropology', name: 'Anthropology', nameBn: 'নৃবিজ্ঞান', sortOrder: 1 },
  { slug: 'arabic', name: 'Arabic', nameBn: 'আরবি', sortOrder: 2 },
  { slug: 'bangla', name: 'Bangla', nameBn: 'বাংলা', sortOrder: 3 },
  {
    slug: 'biochemistry',
    name: 'Biochemistry and Molecular Biology',
    nameBn: 'জৈব রসায়ন ও আণবিক জীববিজ্ঞান',
    sortOrder: 4,
  },
  { slug: 'botany', name: 'Botany', nameBn: 'উদ্ভিদবিজ্ঞান', sortOrder: 5 },
  { slug: 'chemistry', name: 'Chemistry', nameBn: 'রসায়ন', sortOrder: 6 },
  { slug: 'economics', name: 'Economics', nameBn: 'অর্থনীতি', sortOrder: 7 },
  { slug: 'english', name: 'English', nameBn: 'ইংরেজি', sortOrder: 8 },
  {
    slug: 'environment_science',
    name: 'Environment Science',
    nameBn: 'পরিবেশ বিজ্ঞান',
    sortOrder: 9,
  },
  {
    slug: 'finance_and_banking',
    name: 'Finance and Banking',
    nameBn: 'ফিন্যান্স ও ব্যাংকিং',
    sortOrder: 10,
  },
  {
    slug: 'geography_and_environment',
    name: 'Geography and Environment',
    nameBn: 'ভূগোল ও পরিবেশ',
    sortOrder: 11,
  },
  { slug: 'history', name: 'History', nameBn: 'ইতিহাস', sortOrder: 12 },
  {
    slug: 'home_economics',
    name: 'Home Economics',
    nameBn: 'গার্হস্থ্য অর্থনীতি',
    sortOrder: 13,
  },
  {
    slug: 'islamic_history_culture',
    name: 'Islamic History and Culture',
    nameBn: 'ইসলামের ইতিহাস ও সংস্কৃতি',
    sortOrder: 14,
  },
  {
    slug: 'islamic_studies',
    name: 'Islamic Studies',
    nameBn: 'ইসলামিক স্টাডিজ',
    sortOrder: 15,
  },
  {
    slug: 'library_science',
    name: 'Library and Information Science',
    nameBn: 'গ্রন্থাগার ও তথ্যবিজ্ঞান',
    sortOrder: 16,
  },
  { slug: 'management', name: 'Management', nameBn: 'ব্যবস্থাপনা', sortOrder: 17 },
  { slug: 'marketing', name: 'Marketing', nameBn: 'মার্কেটিং', sortOrder: 18 },
  { slug: 'mathematics', name: 'Mathematics', nameBn: 'গণিত', sortOrder: 19 },
  { slug: 'pali', name: 'Pali', nameBn: 'পালি', sortOrder: 20 },
  { slug: 'philosophy', name: 'Philosophy', nameBn: 'দর্শন', sortOrder: 21 },
  { slug: 'physics', name: 'Physics', nameBn: 'পদার্থবিজ্ঞান', sortOrder: 22 },
  {
    slug: 'political_science',
    name: 'Political Science',
    nameBn: 'রাষ্ট্রবিজ্ঞান',
    sortOrder: 23,
  },
  { slug: 'psychology', name: 'Psychology', nameBn: 'মনোবিজ্ঞান', sortOrder: 24 },
  { slug: 'sanskrit', name: 'Sanskrit', nameBn: 'সংস্কৃত', sortOrder: 25 },
  { slug: 'social_work', name: 'Social Work', nameBn: 'সমাজকর্ম', sortOrder: 26 },
  { slug: 'sociology', name: 'Sociology', nameBn: 'সমাজবিজ্ঞান', sortOrder: 27 },
  { slug: 'soil_science', name: 'Soil Science', nameBn: 'মৃত্তিকা বিজ্ঞান', sortOrder: 28 },
  { slug: 'statistics', name: 'Statistics', nameBn: 'পরিসংখ্যান', sortOrder: 29 },
  { slug: 'zoology', name: 'Zoology', nameBn: 'প্রাণিবিজ্ঞান', sortOrder: 30 },
];

export const STARTER_YEARS: YearSeed[] = [
  { slug: '1', label: '1st Year', labelBn: '১ম বর্ষ', sortOrder: 0 },
  { slug: '2', label: '2nd Year', labelBn: '২য় বর্ষ', sortOrder: 1 },
  { slug: '3', label: '3rd Year', labelBn: '৩য় বর্ষ', sortOrder: 2 },
  { slug: '4', label: '4th Year', labelBn: '৪র্থ বর্ষ', sortOrder: 3 },
];
