import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

export type AdminLanguage = 'en' | 'my'

const translations: Record<AdminLanguage, Record<string, string>> = {
  en: {},
  my: {
    'Navigation': 'လမ်းညွှန်',
    'Control center': 'ထိန်းချုပ်ရေးစင်တာ',
    'Page': 'စာမျက်နှာ',
    'Dashboard': 'ဒက်ရှ်ဘုတ်',
    'Orders': 'အော်ဒါများ',
    'All Orders': 'အော်ဒါအားလုံး',
    'Shipping': 'ပို့ဆောင်မှု',
    'Products': 'ကုန်ပစ္စည်းများ',
    'All Products': 'ကုန်ပစ္စည်းအားလုံး',
    'Categories': 'အမျိုးအစားများ',
    'Brands': 'အမှတ်တံဆိပ်များ',
    'Coupons': 'ကူပွန်များ',
    'Inventory': 'စတော့စာရင်း',
    'Sellers': 'ရောင်းချသူများ',
    'Seller Approvals': 'ရောင်းချသူအတည်ပြုချက်များ',
    'All Sellers': 'ရောင်းချသူအားလုံး',
    'Customers': 'ဖောက်သည်များ',
    'All Customers': 'ဖောက်သည်အားလုံး',
    'Payments': 'ငွေပေးချေမှုများ',
    'Transactions': 'ငွေလွှဲမှတ်တမ်းများ',
    'Refunds': 'ပြန်အမ်းငွေ',
    'Commission': 'ကော်မရှင်',
    'Commission Settings': 'ကော်မရှင်ဆက်တင်များ',
    'Reports': 'အစီရင်ခံစာများ',
    'Settings': 'ဆက်တင်များ',
    'General Settings': 'အထွေထွေဆက်တင်များ',
    'Audit Logs': 'စာရင်းစစ်မှတ်တမ်း',
    'Log out': 'ထွက်ရန်',
    'Super admin': 'စူပါအက်ဒမင်',
    'Administrator': 'အက်ဒမင်',
    'Language': 'ဘာသာစကား',
    'English': 'အင်္ဂလိပ်',
    'Burmese': 'မြန်မာ',
    'Toggle theme': 'အပြင်အဆင်ပြောင်းရန်',
    'Collapse sidebar': 'ဘေးမီနူးကျုံ့ရန်',
    'Expand sidebar': 'ဘေးမီနူးချဲ့ရန်',
    'Open navigation': 'လမ်းညွှန်ဖွင့်ရန်',
    'Close navigation': 'လမ်းညွှန်ပိတ်ရန်',
    'Loading data…': 'ဒေတာတင်နေသည်…',
    'Unable to load this data.': 'ဒေတာကို တင်၍မရပါ။',
    'Previous page': 'ယခင်စာမျက်နှာ',
    'Next page': 'နောက်စာမျက်နှာ',
    'Page {page} of {pages}': 'စာမျက်နှာ {page} / {pages}',
    'Are you sure? This action is recorded.': 'သေချာပါသလား။ ဤလုပ်ဆောင်ချက်ကို မှတ်တမ်းတင်မည်။',
    'Active': 'အသုံးပြုနေသည်',
    'Inactive': 'အသုံးမပြုပါ',
    'Pending': 'စောင့်ဆိုင်းနေသည်',
    'Processing': 'လုပ်ဆောင်နေသည်',
    'Confirmed': 'အတည်ပြုပြီး',
    'Shipped': 'ပို့ပြီး',
    'Delivered': 'ရောက်ပြီး',
    'Cancelled': 'ပယ်ဖျက်ပြီး',
    'Paid': 'ငွေပေးပြီး',
    'Failed': 'မအောင်မြင်ပါ',
    'Refunded': 'ငွေပြန်အမ်းပြီး',
    'Published': 'ထုတ်ပြန်ပြီး',
    'Archived': 'သိမ်းဆည်းပြီး',
    'Protected': 'ကာကွယ်ထားသည်',
  },
}

type LanguageContextValue = {
  language: AdminLanguage
  setLanguage: (language: AdminLanguage) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readLanguage(): AdminLanguage {
  return typeof window !== 'undefined' && window.localStorage.getItem('kipi.admin.language') === 'my' ? 'my' : 'en'
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<AdminLanguage>(readLanguage)

  useEffect(() => {
    window.localStorage.setItem('kipi.admin.language', language)
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => {
      let translated = translations[language][key] ?? key
      Object.entries(values ?? {}).forEach(([name, replacement]) => {
        translated = translated.replaceAll(`{${name}}`, String(replacement))
      })
      return translated
    },
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
