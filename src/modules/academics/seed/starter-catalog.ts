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

export type CollegeSeed = {
  slug: string;
  name: string;
  district: string;
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

export const STARTER_COLLEGES: CollegeSeed[] = [
  { slug: 'du-aff-demo', name: 'Dhaka College', district: 'Dhaka', sortOrder: 0 },
  { slug: 'eden', name: 'Eden Mohila College', district: 'Dhaka', sortOrder: 1 },
  { slug: 'titumir', name: 'Government Titumir College', district: 'Dhaka', sortOrder: 2 },
  { slug: 'kabi-nazrul', name: 'Government Kabi Nazrul College', district: 'Dhaka', sortOrder: 3 },
  { slug: 'begum-badrunnessa', name: 'Begum Badrunnessa Government Girls’ College', district: 'Dhaka', sortOrder: 4 },
  { slug: 'mirpur', name: 'Government Bangla College', district: 'Dhaka', sortOrder: 5 },
  { slug: 'tejturi-bazar', name: 'Tejgaon College', district: 'Dhaka', sortOrder: 6 },
  { slug: 'new-govt-deg', name: 'New Government Degree College', district: 'Rajshahi', sortOrder: 7 },
  { slug: 'raj-college', name: 'Rajshahi College', district: 'Rajshahi', sortOrder: 8 },
  { slug: 'carmichael', name: 'Carmichael College', district: 'Rangpur', sortOrder: 9 },
  { slug: 'rangpur-govt', name: 'Rangpur Government College', district: 'Rangpur', sortOrder: 10 },
  { slug: 'chittagong-college', name: 'Chittagong College', district: 'Chattogram', sortOrder: 11 },
  { slug: 'govt-city-ctg', name: 'Government City College', district: 'Chattogram', sortOrder: 12 },
  { slug: 'comilla-victoria', name: 'Comilla Victoria Government College', district: 'Cumilla', sortOrder: 13 },
  { slug: 'brahmanbaria', name: 'Brahmanbaria Government College', district: 'Brahmanbaria', sortOrder: 14 },
  { slug: 'mymensingh', name: 'Ananda Mohan College', district: 'Mymensingh', sortOrder: 15 },
  { slug: 'nasirabad', name: 'Nasirabad College', district: 'Mymensingh', sortOrder: 16 },
  { slug: 'sylhet-mc', name: 'Murari Chand College', district: 'Sylhet', sortOrder: 17 },
  { slug: 'madan-mohan', name: 'Madan Mohan College', district: 'Sylhet', sortOrder: 18 },
  { slug: 'khulna-govt', name: 'Government B. L. College', district: 'Khulna', sortOrder: 19 },
  { slug: 'azam-khan', name: 'Azam Khan Government Commerce College', district: 'Khulna', sortOrder: 20 },
  { slug: 'jessore-govt', name: 'Michael Madhusudan College', district: 'Jashore', sortOrder: 21 },
  { slug: 'barishal-bm', name: 'Brojomohun College', district: 'Barishal', sortOrder: 22 },
  { slug: 'barishal-govt', name: 'Government Syed Hatem Ali College', district: 'Barishal', sortOrder: 23 },
  { slug: 'bogura-azizul', name: 'Government Azizul Haque College', district: 'Bogura', sortOrder: 24 },
  { slug: 'pabna-edward', name: 'Edward College', district: 'Pabna', sortOrder: 25 },
  { slug: 'kushtia-govt', name: 'Kushtia Government College', district: 'Kushtia', sortOrder: 26 },
  { slug: 'faridpur-rajendra', name: 'Rajendra College', district: 'Faridpur', sortOrder: 27 },
  { slug: 'tangail-govt', name: 'Government Saadat College', district: 'Tangail', sortOrder: 28 },
  { slug: 'gazipur-govt', name: 'Bhawal Badre Alam Government College', district: 'Gazipur', sortOrder: 29 },
  { slug: 'narayanganj-govt', name: 'Government Tolaram College', district: 'Narayanganj', sortOrder: 30 },
  { slug: 'savar-govt', name: 'Savar Government College', district: 'Dhaka', sortOrder: 31 },
  { slug: 'dinajpur-surendranath', name: 'Surendranath College', district: 'Dinajpur', sortOrder: 32 },
  { slug: 'noakhali-govt', name: 'Noakhali Government College', district: 'Noakhali', sortOrder: 33 },
  { slug: 'feni-govt', name: 'Feni Government College', district: 'Feni', sortOrder: 34 },
];
