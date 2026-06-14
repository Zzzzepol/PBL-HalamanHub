// HalamanHub — Shared Tailwind class compositions for pages
// Centralizing repeated utility strings keeps page components

export const grid = {
  stats: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 mb-[18px]',
  stats4: 'grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]',
  twoCol: 'grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5',
  threeCol: 'grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-3.5',
  colStack: 'flex flex-col gap-3.5',
  formRow: 'grid grid-cols-1 md:grid-cols-2 gap-3 mb-3',
};

export const lastCard = 'mb-0';

/* Irrigation status pills */
export const irrRow = 'flex items-center justify-between gap-2.5 mb-3 flex-wrap';
export const irrStatus = 'inline-flex items-center gap-2 px-3.5 py-[7px] rounded-full text-base font-medium';
export const irrOn = `${irrStatus} bg-green-50 text-green-800`;
export const irrOff = `${irrStatus} bg-bg-secondary text-text-secondary`;
export const irrMeta = 'text-xs text-text-secondary mt-1';
export const btnRow = 'flex gap-2 flex-wrap';

/* Water tank card */
export const tankRow = 'flex items-center gap-4 max-md:flex-col max-md:text-center';
export const tankInfo = 'flex-1 min-w-0';
export const tankVal = 'text-[22px] font-medium text-text-primary';
export const tankSub = 'text-sm text-text-secondary mb-2';
export const tankMeta = 'text-sm text-text-secondary mt-1';
export const greenText = 'text-green-800';
export const tankBadge = 'mt-2.5';

/* NPK */
export const npkRow = 'flex gap-3 max-[480px]:gap-1.5 justify-around mt-1';
export const npkLegend = 'mt-3.5 pt-2.5 border-t-[0.5px] border-border flex gap-3.5 flex-wrap text-sm text-text-secondary [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5';

/* Alerts */
export const alertItem = 'flex items-start gap-2.5 py-2.5 border-b-[0.5px] border-border last:border-b-0';
export const alertIcon = 'w-[30px] h-[30px] rounded-sm flex items-center justify-center flex-shrink-0 text-[15px]';
export const alertIconVariant = {
  warning: `${alertIcon} bg-amber-50 text-amber-800`,
  error: `${alertIcon} bg-red-50 text-red-800`,
  ok: `${alertIcon} bg-green-50 text-green-800`,
};
export const alertText = 'text-sm text-text-primary leading-snug';
export const alertTime = 'text-xs text-text-secondary mt-0.5';

/* Schedule items */
export const schedItem = 'flex items-center gap-3 py-2.5 border-b-[0.5px] border-border last:border-b-0 flex-wrap';
export const schedTime = 'text-base font-medium text-text-primary min-w-[75px]';
export const schedZone = 'text-sm text-text-secondary flex-1 min-w-[100px]';
export const schedDur = 'text-sm text-text-secondary';
export const schedRight = 'flex items-center gap-2.5 ml-auto';

/* Filter bar */
export const filterBar = 'flex gap-2.5 mb-3.5 flex-wrap items-center [&>*]:flex-shrink-0';
export const filterSearch = 'flex-1 min-w-[180px] flex-shrink';

/* Pagination */
export const pagination = 'flex items-center justify-between px-4 py-3 border-t-[0.5px] border-border flex-wrap gap-2.5';
export const pageInfo = 'text-sm text-text-secondary';
export const pageBtns = 'flex gap-1.5';
export const pageBtn = 'w-[30px] h-[30px] flex items-center justify-center rounded-md border-[0.5px] border-border bg-bg-primary text-text-secondary cursor-pointer text-sm hover:bg-bg-secondary disabled:opacity-40 disabled:cursor-not-allowed';
export const pageBtnActive = 'bg-green-800 text-white border-green-800 hover:bg-green-800';

/* Table cell helpers */
export const cellWithAvatar = 'flex items-center gap-2.5';
export const actionBtns = 'flex gap-1.5';

/* Report cards */
export const reportCard = 'flex flex-col items-center py-[26px] px-4 gap-2.5 text-center cursor-pointer transition-colors duration-150 hover:bg-bg-secondary';
export const reportIcon = 'w-11 h-11 rounded-md flex items-center justify-center text-[22px] mb-1';
export const reportTitle = 'text-md font-medium text-text-primary';
export const reportDesc = 'text-sm text-text-secondary';

/* Settings toggle row */
export const toggleRow = 'flex items-start gap-3 mb-4 last:mb-0';
export const toggleRowText = 'flex flex-col gap-0.5';
export const toggleRowTitle = 'text-base text-text-primary';
export const toggleRowDesc = 'text-xs text-text-secondary';

/* Modal */
export const modalOverlay = 'fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-5 animate-fade-in-only';
export const modal = 'bg-bg-primary rounded-lg w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-lg';
export const modalHeader = 'flex items-center justify-between px-[18px] py-4 border-b-[0.5px] border-border';
export const modalTitle = 'text-lg font-medium';
export const modalClose = 'bg-transparent border-none text-lg text-text-secondary cursor-pointer w-[30px] h-[30px] flex items-center justify-center rounded-md hover:bg-bg-secondary';
export const modalBody = 'p-[18px]';
export const modalFooter = 'flex justify-end gap-2.5 px-[18px] py-3.5 border-t-[0.5px] border-border';

/* Image upload box */
export const uploadBox = 'border-[1.5px] border-dashed border-border-medium rounded-md p-6 text-center text-text-secondary cursor-pointer transition-colors duration-150 hover:border-green-600 hover:bg-green-50 [&_.ti]:text-[28px] [&_.ti]:mb-1.5 [&_.ti]:block';
export const uploadBoxText = 'text-sm';
