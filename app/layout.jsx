export const metadata = {
  title: "Kynda",
  description: "Discover the connections between your favorite works of culture, and the creators behind them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#0f1016", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
