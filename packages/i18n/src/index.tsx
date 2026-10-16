import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'

export type Language = 'en' | 'my'

const STORAGE_KEY = 'kipi.language'
const LEGACY_ADMIN_STORAGE_KEY = 'kipi.admin.language'

const burmese: Record<string, string> = {
  'Navigation': 'လမ်းညွှန်',
  'Control center': 'ထိန်းချုပ်ရေးစင်တာ',
  'Page': 'စာမျက်နှာ',
  'Dashboard': 'ဒက်ရှ်ဘုတ်',
  'Orders': 'အော်ဒါများ',
  'All Orders': 'အော်ဒါအားလုံး',
  'Shipping': 'ပို့ဆောင်မှု',
  'Products': 'ကုန်ပစ္စည်းများ',
  'All Products': 'ကုန်ပစ္စည်းအားလုံး',
  'Product Management': 'ကုန်ပစ္စည်းစီမံခန့်ခွဲမှု',
  'Product Listing': 'ကုန်ပစ္စည်းစာရင်း',
  'Add Product': 'ကုန်ပစ္စည်းထည့်ရန်',
  'Create a new product': 'ကုန်ပစ္စည်းအသစ်ဖန်တီးရန်',
  'Edit product': 'ကုန်ပစ္စည်းပြင်ရန်',
  'Categories': 'အမျိုးအစားများ',
  'Category': 'အမျိုးအစား',
  'Brands': 'အမှတ်တံဆိပ်များ',
  'Brand': 'အမှတ်တံဆိပ်',
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
  'Signing out…': 'ထွက်နေသည်…',
  'My Profile': 'ကျွန်ုပ်၏ပရိုဖိုင်',
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
  'Open menu': 'မီနူးဖွင့်ရန်',
  'Close menu': 'မီနူးပိတ်ရန်',
  'Open search': 'ရှာဖွေမှုဖွင့်ရန်',
  'Open profile menu': 'ပရိုဖိုင်မီနူးဖွင့်ရန်',
  'Profile menu': 'ပရိုဖိုင်မီနူး',
  'Loading…': 'တင်နေသည်…',
  'Loading data…': 'ဒေတာတင်နေသည်…',
  'Loading categories…': 'အမျိုးအစားများ တင်နေသည်…',
  'Loading products…': 'ကုန်ပစ္စည်းများ တင်နေသည်…',
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
  'Secure payment': 'လုံခြုံသော ငွေပေးချေမှု',
  'Customer support': 'ဖောက်သည်အကူအညီ',
  'Account': 'အကောင့်',
  'Sign in': 'ဝင်ရောက်ရန်',
  'Wishlist': 'နှစ်သက်ရာများ',
  'Cart': 'စျေးခြင်း',
  'Shopping cart': 'စျေးခြင်း',
  'Menu': 'မီနူး',
  'Home': 'ပင်မစာမျက်နှာ',
  'Shop all': 'အားလုံးကြည့်ရန်',
  'Stores': 'ဆိုင်များ',
  'New arrivals': 'အသစ်ရောက်ရှိ',
  'Deals': 'အထူးလျှော့စျေးများ',
  'All Categories': 'အမျိုးအစားအားလုံး',
  'More': 'ပိုမိုကြည့်ရန်',
  'Browse categories': 'အမျိုးအစားများ ကြည့်ရန်',
  'Categories unavailable.': 'အမျိုးအစားများ မရရှိနိုင်ပါ။',
  'View product': 'ကုန်ပစ္စည်းကြည့်ရန်',
  'Products are temporarily unavailable.': 'ကုန်ပစ္စည်းများ ခေတ္တမရရှိနိုင်ပါ။',
  'No products in this category yet.': 'ဤအမျိုးအစားတွင် ကုန်ပစ္စည်းမရှိသေးပါ။',
  'Choose a category': 'အမျိုးအစားရွေးပါ',
  'Select a category to see its available products.': 'ရရှိနိုင်သော ကုန်ပစ္စည်းများကြည့်ရန် အမျိုးအစားရွေးပါ။',
  'Kipi marketplace': 'Kipi ဈေးကွက်',
  'Find your next favorite.': 'နောက်ထပ်နှစ်သက်ရာကို ရှာဖွေပါ။',
  'Browse real products from approved marketplace sellers.': 'အတည်ပြုထားသော ရောင်းချသူများထံမှ တကယ့်ကုန်ပစ္စည်းများကို ကြည့်ရှုပါ။',
  'Shop products': 'ကုန်ပစ္စည်းများ ဝယ်ယူရန်',
  'Search products, brands, and categories...': 'ကုန်ပစ္စည်း၊ အမှတ်တံဆိပ်နှင့် အမျိုးအစားများ ရှာဖွေပါ...',
  'Search products': 'ကုန်ပစ္စည်းများ ရှာဖွေပါ',
  'Search': 'ရှာဖွေရန်',
  'Explore Kipi': 'Kipi ကိုလေ့လာရန်',
  'Customer care': 'ဖောက်သည်ဝန်ဆောင်မှု',
  'Stay connected': 'ဆက်သွယ်ထားရန်',
  'Help center & FAQ': 'အကူအညီနှင့် မေးလေ့ရှိသောမေးခွန်းများ',
  'Contact support': 'အကူအညီဆက်သွယ်ရန်',
  'Order tracking': 'အော်ဒါခြေရာခံရန်',
  'Account help': 'အကောင့်အကူအညီ',
  'Contact': 'ဆက်သွယ်ရန်',
  'About': 'အကြောင်း',
  'About Kipi': 'Kipi အကြောင်း',
  'Promotions': 'ပရိုမိုးရှင်းများ',
  'Order details': 'အော်ဒါအသေးစိတ်',
  'Track shipment': 'ပို့ဆောင်မှုခြေရာခံရန်',
  'Order history.': 'အော်ဒါမှတ်တမ်း',
  'Notifications.': 'အသိပေးချက်များ',
  'Saved for later.': 'နောက်မှကြည့်ရန် သိမ်းထားသည်',
  'No notifications': 'အသိပေးချက်မရှိပါ',
  'No orders yet': 'အော်ဒါမရှိသေးပါ',
  'Your wishlist is empty': 'နှစ်သက်ရာစာရင်း လွတ်နေပါသည်',
  'Nothing to check out': 'ငွေချေရန် မရှိသေးပါ',
  'Add a delivery address': 'ပို့ဆောင်ရန်လိပ်စာ ထည့်ပါ',
  'Delivery address': 'ပို့ဆောင်ရန်လိပ်စာ',
  'Shipping method': 'ပို့ဆောင်နည်းလမ်း',
  'Payment': 'ငွေပေးချေမှု',
  'Payment method': 'ငွေပေးချေနည်းလမ်း',
  'Order summary': 'အော်ဒါအနှစ်ချုပ်',
  'Subtotal': 'ကုန်ပစ္စည်းစုစုပေါင်း',
  'Tax': 'အခွန်',
  'Total': 'စုစုပေါင်း',
  'Proceed to checkout': 'ငွေချေရန် ဆက်သွားပါ',
  'Continue shopping': 'ဆက်လက်ဝယ်ယူရန်',
  'Secure checkout': 'လုံခြုံသော ငွေချေမှု',
  'Review': 'ပြန်လည်စစ်ဆေးရန်',
  'Delivery': 'ပို့ဆောင်မှု',
  'Create account': 'အကောင့်ဖန်တီးရန်',
  'Welcome back': 'ပြန်လည်ကြိုဆိုပါသည်',
  'Password': 'စကားဝှက်',
  'Email': 'အီးမေးလ်',
  'Forgot your password?': 'စကားဝှက်မေ့နေပါသလား။',
  'Sign up': 'အကောင့်ဖွင့်ရန်',
  'Save': 'သိမ်းရန်',
  'Cancel': 'ပယ်ဖျက်ရန်',
  'Close': 'ပိတ်ရန်',
  'Back': 'နောက်သို့',
  'Next': 'ရှေ့သို့',
  'Previous': 'ယခင်',
  'No data available': 'ဒေတာမရှိသေးပါ',
  'Seller workspace': 'ရောင်းချသူလုပ်ငန်းခွင်',
  'Seller account': 'ရောင်းချသူအကောင့်',
  'Open storefront': 'စတိုးမျက်နှာစာဖွင့်ရန်',
  'Search seller products': 'ရောင်းချသူကုန်ပစ္စည်းများ ရှာဖွေပါ',
  'Notifications': 'အသိပေးချက်များ',
  'Fulfillment': 'အော်ဒါဖြည့်ဆည်းမှု',
  'Earnings': 'ဝင်ငွေ',
  'Payouts': 'ငွေထုတ်ယူမှုများ',
  'Store settings': 'စတိုးဆက်တင်များ',
  'Product information': 'ကုန်ပစ္စည်းအချက်အလက်',
  'Variants, sizes, and colors': 'မျိုးကွဲ၊ အရွယ်အစားနှင့် အရောင်များ',
  'Image gallery': 'ပုံများစုစည်းမှု',
  'Publishing': 'ထုတ်ပြန်မှု',
  'Product name': 'ကုန်ပစ္စည်းအမည်',
  'URL slug': 'URL အမည်',
  'Description': 'ဖော်ပြချက်',
  'Price': 'စျေးနှုန်း',
  'Stock quantity': 'စတော့အရေအတွက်',
  'Status': 'အခြေအနေ',
  'Reviews': 'သုံးသပ်ချက်များ',
  'Action': 'လုပ်ဆောင်ချက်',
  'In stock': 'စတော့ရှိသည်',
  'Out of stock': 'စတော့ကုန်ပြီ',
  'Limited': 'အကန့်အသတ်ရှိ',
  'No reviews': 'သုံးသပ်ချက်မရှိသေးပါ',
  'No products yet. Add your first product to start selling.': 'ကုန်ပစ္စည်းမရှိသေးပါ။ စတင်ရောင်းချရန် ပထမဆုံးကုန်ပစ္စည်းထည့်ပါ။',
  'Shipment summary': 'ပို့ဆောင်မှုအနှစ်ချုပ်',
  'Update status': 'အခြေအနေပြောင်းရန်',
  'Tracking history': 'ခြေရာခံမှတ်တမ်း',
  'Products in this shipment': 'ဤပို့ဆောင်မှုပါ ကုန်ပစ္စည်းများ',
  'Create shipment': 'ပို့ဆောင်မှုဖန်တီးရန်',
  'Self delivery': 'ကိုယ်တိုင်ပို့ဆောင်မှု',
  'Carrier name': 'ပို့ဆောင်ရေးအမည်',
  'Tracking number': 'ခြေရာခံနံပါတ်',
  'Assigned rider': 'တာဝန်ပေးထားသော ပို့ဆောင်သူ',
  'Estimated delivery': 'ခန့်မှန်းပို့ဆောင်ရက်',
  'Track package': 'ပါဆယ်ခြေရာခံရန်',
  'Copy tracking': 'ခြေရာခံနံပါတ် ကူးရန်',
  'Copied': 'ကူးယူပြီး',
  'No tracking events recorded.': 'ခြေရာခံမှတ်တမ်း မရှိသေးပါ။',
  'Shipment not created yet': 'ပို့ဆောင်မှု မဖန်တီးရသေးပါ',
  'No seller orders are available for fulfillment.': 'ဖြည့်ဆည်းရန် ရောင်းချသူအော်ဒါ မရှိသေးပါ။',
  'Commission history': 'ကော်မရှင်မှတ်တမ်း',
  'Total sales': 'ရောင်းအားစုစုပေါင်း',
  'Commission deducted': 'နုတ်ယူထားသော ကော်မရှင်',
  'Net earnings': 'အသားတင်ဝင်ငွေ',
  'Pending earnings': 'ဆိုင်းငံ့ဝင်ငွေ',
  'Paid earnings': 'ပေးချေပြီးဝင်ငွေ',
  'Refund adjustments': 'ပြန်အမ်းငွေ ပြင်ဆင်ချက်များ',
  'General': 'အထွေထွေ',
  'Search…': 'ရှာဖွေပါ…',
  'Clear search': 'ရှာဖွေမှုဖျက်ရန်',
  'Overview': 'အနှစ်ချုပ်',
  'Workspace': 'လုပ်ငန်းခွင်',
  'Seller portal': 'ရောင်းချသူပေါ်တယ်',
  'KIPI MARKETPLACE': 'KIPI ဈေးကွက်',
  'SELLER WORKSPACE': 'ရောင်းချသူလုပ်ငန်းခွင်',
  'Product media': 'ကုန်ပစ္စည်းမီဒီယာ',
  'Pricing and inventory': 'စျေးနှုန်းနှင့် စတော့စာရင်း',
  'Save changes': 'ပြောင်းလဲမှုများ သိမ်းရန်',
  'Saving changes…': 'ပြောင်းလဲမှုများ သိမ်းနေသည်…',
  'New product': 'ကုန်ပစ္စည်းအသစ်',
  'Choose image file': 'ပုံဖိုင်ရွေးပါ',
  'Sales Trend': 'ရောင်းအားလမ်းကြောင်း',
  'Track sales performance over time.': 'အချိန်အလိုက် ရောင်းအားစွမ်းဆောင်ရည်ကို စောင့်ကြည့်ပါ။',
  'Current fulfillment mix': 'လက်ရှိအော်ဒါဖြည့်ဆည်းမှု အချိုးအစား',
  'Latest customer activity': 'နောက်ဆုံးဖောက်သည် လုပ်ဆောင်ချက်',
  'Low stock alert': 'စတော့နည်းနေကြောင်း သတိပေးချက်',
  'View all': 'အားလုံးကြည့်ရန်',
  'Manage': 'စီမံရန်',
  'Revenue': 'ဝင်ငွေ',
  'Recent order': 'လတ်တလောအော်ဒါ',
  'Order status': 'အော်ဒါအခြေအနေ',
  '7 Day': '၇ ရက်',
  '30 Day': '၃၀ ရက်',
  '90 Day': '၉၀ ရက်',
  'Updating…': 'ပြင်ဆင်နေသည်…',
  'Retry': 'ပြန်ကြိုးစားရန်',
  'Customer': 'ဖောက်သည်',
  'Store': 'ဆိုင်',
  'Applicant': 'လျှောက်ထားသူ',
  'Approve': 'အတည်ပြုရန်',
  'Approved': 'အတည်ပြုပြီး',
  'Suspended': 'ဆိုင်းငံ့ထားသည်',
  'Detail': 'အသေးစိတ်',
  'Product': 'ကုန်ပစ္စည်း',
  'Order': 'အော်ဒါ',
  'Order detail': 'အော်ဒါအသေးစိတ်',
  'Order value': 'အော်ဒါတန်ဖိုး',
  'Orders in period': 'ကာလအတွင်း အော်ဒါများ',
  'Recognized revenue': 'အသိအမှတ်ပြုဝင်ငွေ',
  'This month': 'ယခုလ',
  'Last 7 days': 'လွန်ခဲ့သော ၇ ရက်',
  'Last 30 days': 'လွန်ခဲ့သော ၃၀ ရက်',
  'Top product': 'ရောင်းအားအကောင်းဆုံး ကုန်ပစ္စည်း',
  'Appearance': 'အပြင်အဆင်',
  'Apply and save': 'အသုံးပြုပြီး သိမ်းရန်',
  'Reset to default': 'မူလအတိုင်း ပြန်ထားရန်',
  'Live preview': 'တိုက်ရိုက်ကြိုတင်ကြည့်ရှုမှု',
  'Color palette': 'အရောင်အစု',
  'Font family': 'ဖောင့်အမျိုးအစား',
  'Base font size': 'အခြေခံဖောင့်အရွယ်',
  'Commission control': 'ကော်မရှင်ထိန်းချုပ်မှု',
  'Commission switch': 'ကော်မရှင်ခလုတ်',
  'Choose seller': 'ရောင်းချသူရွေးပါ',
  'Enabled': 'ဖွင့်ထားသည်',
  'Disabled': 'ပိတ်ထားသည်',
  'External courier': 'ပြင်ပပို့ဆောင်ရေး',
  'Payment control': 'ငွေပေးချေမှုထိန်းချုပ်မှု',
  'Authorization': 'ခွင့်ပြုချက်',
  'Admin interface': 'အက်ဒမင်မျက်နှာပြင်',
  'All status': 'အခြေအနေအားလုံး',
  'All role': 'တာဝန်အားလုံး',
  'All fulfillment state': 'ဖြည့်ဆည်းမှုအခြေအနေအားလုံး',
  'Low stock only': 'စတော့နည်းသည့်အရာများသာ',
  'On hand': 'လက်ကျန်',
  'Reserved': 'ကြိုတင်ဖယ်ထားသည်',
  'Available': 'ရရှိနိုင်သည်',
  'Qty': 'အရေအတွက်',
  'Line total': 'လိုင်းစုစုပေါင်း',
  'Transaction reference': 'ငွေလွှဲရည်ညွှန်းချက်',
  'Transaction': 'ငွေလွှဲမှတ်တမ်း',
  'Date': 'ရက်စွဲ',
  'Name': 'အမည်',
  'Phone': 'ဖုန်း',
  'Address': 'လိပ်စာ',
  'Actions': 'လုပ်ဆောင်ချက်များ',
  'Edit': 'ပြင်ရန်',
  'Delete': 'ဖျက်ရန်',
  'Clear': 'ရှင်းရန်',
  'Preview': 'ကြိုတင်ကြည့်ရန်',
  'Image': 'ပုံ',
  'Image URL': 'ပုံ URL',
  'Alt text': 'အစားထိုးစာသား',
  'Upload file': 'ဖိုင်တင်ရန်',
  'Add variant': 'မျိုးကွဲထည့်ရန်',
  'Variant': 'မျိုးကွဲ',
  'Attributes JSON': 'Attributes JSON',
  'Compare-at price': 'နှိုင်းယှဉ်စျေးနှုန်း',
  'Currency': 'ငွေကြေး',
  'Price (minor units)': 'စျေးနှုန်း (အငယ်ယူနစ်)',
  'SKU': 'SKU',
  'Slug': 'Slug',
  'Visibility': 'မြင်နိုင်မှု',
  'Draft': 'မူကြမ်း',
  'No brand': 'အမှတ်တံဆိပ်မရှိ',
  'Select category': 'အမျိုးအစားရွေးပါ',
  'Save product': 'ကုန်ပစ္စည်းသိမ်းရန်',
  'Save coupon': 'ကူပွန်သိမ်းရန်',
  'New coupon': 'ကူပွန်အသစ်',
  'Code': 'ကုဒ်',
  'Discount': 'လျှော့စျေး',
  'Fixed amount': 'သတ်မှတ်ငွေပမာဏ',
  'Type': 'အမျိုးအစား',
  'Usage': 'အသုံးပြုမှု',
  'Usage limit': 'အသုံးပြုခွင့်ကန့်သတ်ချက်',
  'Value': 'တန်ဖိုး',
  'Maximum discount': 'အများဆုံးလျှော့စျေး',
  'Minimum subtotal': 'အနည်းဆုံးစုစုပေါင်း',
  'Remember this device': 'ဤစက်ကို မှတ်ထားရန်',
  'Sign in to continue to your workspace.': 'သင့်လုပ်ငန်းခွင်သို့ ဆက်လက်ဝင်ရောက်ရန် အကောင့်ဝင်ပါ။',
  'Welcome back.': 'ပြန်လည်ကြိုဆိုပါသည်။',
  'KIPI CONTROL CENTER': 'KIPI ထိန်းချုပ်ရေးစင်တာ',
  'Run the store with clarity.': 'စတိုးကို ရှင်းလင်းစွာ စီမံပါ။',
  'Secure operations for catalog, inventory, orders, and customer care.': 'ကတ်တလောက်၊ စတော့၊ အော်ဒါနှင့် ဖောက်သည်ဝန်ဆောင်မှုကို လုံခြုံစွာ စီမံပါ။',
  'Administrator access is logged and audited.': 'အက်ဒမင်ဝင်ရောက်မှုကို မှတ်တမ်းတင်ပြီး စစ်ဆေးထားသည်။',
  'Something went wrong. Please try again.': 'တစ်စုံတစ်ရာ မှားယွင်းနေပါသည်။ ထပ်မံကြိုးစားပါ။',
  'No payment records.': 'ငွေပေးချေမှုမှတ်တမ်း မရှိပါ။',
  'No refunds recorded.': 'ငွေပြန်အမ်းမှတ်တမ်း မရှိပါ။',
  'No shipments created yet.': 'ပို့ဆောင်မှု မဖန်တီးရသေးပါ။',
  'No order items recorded.': 'အော်ဒါပစ္စည်းမှတ်တမ်း မရှိပါ။',
  'No status changes recorded.': 'အခြေအနေပြောင်းလဲမှုမှတ်တမ်း မရှိပါ။',
  'No internal notes.': 'အတွင်းမှတ်စု မရှိပါ။',
}

const values = { en: {}, my: burmese } satisfies Record<Language, Record<string, string>>

export type TranslationKey = string

/** Returns keys that are not available in the Burmese UI resource. */
export function missingTranslations(keys: readonly string[]): string[] {
  return keys.filter((key) => !burmese[key])
}

export type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_ADMIN_STORAGE_KEY)
  return stored === 'my' ? 'my' : 'en'
}

type SourceRecord = { source: string; translated: string }
const textSources = new WeakMap<Text, SourceRecord>()
const attributeSources = new WeakMap<Element, Map<string, SourceRecord>>()

function translateDocument(language: Language) {
  if (typeof document === 'undefined' || !document.body) return
  document.documentElement.lang = language
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node as Text
    const parent = text.parentElement
    if (parent && !parent.closest('[data-i18n-ignore],script,style,noscript')) {
      const current = text.nodeValue ?? ''
      const previous = textSources.get(text)
      const source = previous && current === previous.translated ? previous.source : current
      const trimmed = source.trim()
      const translated = language === 'my' ? values.my[trimmed] ?? source : source
      textSources.set(text, { source, translated })
      if (current !== translated) text.nodeValue = translated
    }
    node = walker.nextNode()
  }
  document.querySelectorAll<HTMLElement>('[placeholder],[aria-label],[title]').forEach((element) => {
    if (element.closest('[data-i18n-ignore]')) return
    const records = attributeSources.get(element) ?? new Map<string, SourceRecord>()
    ;(['placeholder', 'aria-label', 'title'] as const).forEach((attribute) => {
      const current = element.getAttribute(attribute)
      if (current === null) return
      const previous = records.get(attribute)
      const source = previous && current === previous.translated ? previous.source : current
      const translated = language === 'my' ? values.my[source] ?? source : source
      records.set(attribute, { source, translated })
      if (current !== translated) element.setAttribute(attribute, translated)
    })
    attributeSources.set(element, records)
  })
}

function useDocumentLocalization(language: Language) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    let scheduled = false
    const run = () => {
      scheduled = false
      translateDocument(language)
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      queueMicrotask(run)
    }
    run()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] })
    return () => observer.disconnect()
  }, [language])
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<Language>(readLanguage)
  useDocumentLocalization(language)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    // Keep the old Admin key readable for existing Admin sessions and tests.
    window.localStorage.setItem(LEGACY_ADMIN_STORAGE_KEY, language)
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, replacements) => {
      let translated = language === 'my' ? values.my[key] ?? key : key
      Object.entries(replacements ?? {}).forEach(([name, replacement]) => { translated = translated.replaceAll(`{${name}}`, String(replacement)) })
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

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [])

  return <div className="language-switcher" ref={ref}><button className="language-switcher-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-label={t('Language')} aria-expanded={open} aria-haspopup="menu"><span>{language === 'my' ? 'မြန်မာ' : 'English'}</span><span aria-hidden="true">⌄</span></button>{open ? <div className="language-switcher-menu" role="menu" aria-label={t('Language')}><button type="button" role="menuitemradio" aria-checked={language === 'en'} className={language === 'en' ? 'selected' : ''} onClick={() => { setLanguage('en'); setOpen(false) }}>English</button><button type="button" role="menuitemradio" aria-checked={language === 'my'} className={language === 'my' ? 'selected' : ''} onClick={() => { setLanguage('my'); setOpen(false) }}>မြန်မာ</button></div> : null}</div>
}
