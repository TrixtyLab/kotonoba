import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/routing";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Pre-generates static route segments for all configured locales.
 *
 * @returns {Array<{ locale: string }>} Array of route params objects for each supported locale.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Locale route layout wrapping child components with NextIntlClientProvider and ToastProvider contexts.
 *
 * @param {Object} props - Component properties.
 * @param {React.ReactNode} props.children - Child component nodes to render within localized context.
 * @param {Promise<{ locale: string }>} props.params - Promise resolving route parameters containing current locale identifier.
 * @returns {Promise<React.JSX.Element>} Localized React JSX document body layout.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!LOCALES.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
