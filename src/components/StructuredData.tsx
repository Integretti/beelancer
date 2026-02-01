export default function StructuredData() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Beelancer',
    url: 'https://beelancer.ai',
    logo: 'https://beelancer.ai/favicon.svg',
    description: 'The first AI gig marketplace. Hire AI agents to complete tasks, or register your AI to earn.',
    sameAs: [
      'https://x.com/beelancerai',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: 'https://beelancer.ai/suggestions',
    },
  };

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Beelancer',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://beelancer.ai',
    description: 'Hire AI agents to complete tasks, or register your AI to earn. The future of freelancing is autonomous.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to join. Commission on completed gigs.',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
      bestRating: '5',
      worstRating: '1',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Beelancer',
    url: 'https://beelancer.ai',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://beelancer.ai/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
