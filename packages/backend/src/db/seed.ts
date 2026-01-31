import { prisma } from './client.js';
import { AlienAuthService } from '../services/alienAuth.js';
import type { NewsCategory, BiasRating } from '@prisma/client';

async function seed() {
  console.log('Seeding database...');

  // Create news sources
  const sources = [
    {
      name: 'BBC News',
      domain: 'bbc.com',
      rssUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
      biasRating: 'CENTER' as BiasRating,
      logoUrl: 'https://news.bbcimg.co.uk/nol/shared/img/bbc_news_120x60.gif',
    },
    {
      name: 'CNN',
      domain: 'cnn.com',
      rssUrl: 'http://rss.cnn.com/rss/edition.rss',
      biasRating: 'LEFT' as BiasRating,
      logoUrl: 'https://cdn.cnn.com/cnn/.e/img/3.0/global/misc/cnn-logo.png',
    },
    {
      name: 'Fox News',
      domain: 'foxnews.com',
      rssUrl: 'https://moxie.foxnews.com/google-publisher/latest.xml',
      biasRating: 'RIGHT' as BiasRating,
      logoUrl: 'https://global.fncstatic.com/static/orion/img/fox-news.png',
    },
    {
      name: 'Reuters',
      domain: 'reuters.com',
      rssUrl: null,
      biasRating: 'CENTER' as BiasRating,
      logoUrl: 'https://www.reuters.com/pf/resources/images/reuters/logo.png',
    },
    {
      name: 'The New York Times',
      domain: 'nytimes.com',
      rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      biasRating: 'CENTER_LEFT' as BiasRating,
      logoUrl: 'https://www.nytimes.com/vi-assets/static-assets/icon-the-morning_144x144.png',
    },
    {
      name: 'The Wall Street Journal',
      domain: 'wsj.com',
      rssUrl: null,
      biasRating: 'CENTER_RIGHT' as BiasRating,
      logoUrl: 'https://s.wsj.net/img/meta/wsj-social-share.png',
    },
  ];

  const createdSources: Array<{ id: string; name: string }> = [];
  for (const source of sources) {
    const created = await prisma.newsSource.upsert({
      where: { domain: source.domain },
      update: source,
      create: source,
    });
    createdSources.push(created);
  }
  console.log(`Created ${createdSources.length} news sources`);

  // Create sample news events with articles
  const events = [
    {
      title: 'Global Climate Summit Reaches Historic Agreement',
      summary: 'World leaders have agreed to unprecedented measures to combat climate change, including new emissions targets and funding for developing nations.',
      category: 'ENVIRONMENT' as NewsCategory,
      isTrending: true,
      articles: [
        { sourceIndex: 0, title: 'Climate Summit: World Leaders Agree on New Targets', summary: 'The historic agreement sets ambitious goals for reducing carbon emissions.' },
        { sourceIndex: 1, title: 'Breaking: Climate Deal Reached After Marathon Negotiations', summary: 'After days of intense discussions, delegates have finally reached consensus.' },
        { sourceIndex: 4, title: 'Inside the Climate Negotiations: How the Deal Came Together', summary: 'An in-depth look at the diplomatic efforts behind the agreement.' },
      ],
    },
    {
      title: 'Tech Giants Report Record Quarterly Earnings',
      summary: 'Major technology companies have reported better-than-expected earnings, driven by AI investments and cloud computing growth.',
      category: 'TECHNOLOGY' as NewsCategory,
      isTrending: true,
      articles: [
        { sourceIndex: 1, title: 'Apple, Google, Microsoft All Beat Expectations', summary: 'The tech sector continues its strong performance.' },
        { sourceIndex: 5, title: 'Tech Earnings Signal AI Investment Paying Off', summary: 'Analysts say the results validate heavy AI spending.' },
      ],
    },
    {
      title: 'Federal Reserve Signals Potential Rate Cuts',
      summary: 'The Federal Reserve has indicated it may begin cutting interest rates in the coming months as inflation shows signs of cooling.',
      category: 'BUSINESS' as NewsCategory,
      isTrending: false,
      articles: [
        { sourceIndex: 3, title: 'Fed Chair: Rate Cuts on the Table for Next Quarter', summary: 'In a speech today, the Fed Chair outlined the path forward for monetary policy.' },
        { sourceIndex: 5, title: 'Markets Rally on Fed Rate Cut Signals', summary: 'Stocks surged following the announcement.' },
        { sourceIndex: 2, title: 'Fed Considers Rate Cuts Amid Cooling Inflation', summary: 'The move could provide relief to borrowers.' },
      ],
    },
    {
      title: 'Breakthrough in Cancer Treatment Shows Promise',
      summary: 'Researchers have announced promising results from clinical trials of a new immunotherapy treatment for advanced cancer patients.',
      category: 'HEALTH' as NewsCategory,
      isTrending: true,
      articles: [
        { sourceIndex: 0, title: 'New Cancer Treatment Shows 80% Response Rate in Trials', summary: 'The experimental therapy targets specific cancer cells.' },
        { sourceIndex: 4, title: 'Hope for Cancer Patients: Breakthrough Treatment Advances', summary: 'Experts call the results a potential game-changer.' },
      ],
    },
    {
      title: 'Space Agency Announces New Moon Mission',
      summary: 'NASA has unveiled plans for an ambitious new lunar mission that aims to establish a permanent human presence on the Moon.',
      category: 'SCIENCE' as NewsCategory,
      isTrending: false,
      articles: [
        { sourceIndex: 1, title: "NASA's Bold Plan: A Permanent Moon Base by 2030", summary: 'The agency outlined its vision for sustainable lunar exploration.' },
        { sourceIndex: 0, title: 'Return to the Moon: What the New Mission Means', summary: 'Analysis of the scientific and strategic implications.' },
      ],
    },
  ];

  for (const event of events) {
    const slug = event.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80) + '-' + Date.now().toString(36);

    const createdEvent = await prisma.newsEvent.create({
      data: {
        slug,
        title: event.title,
        summary: event.summary,
        category: event.category,
        isTrending: event.isTrending,
      },
    });

    // Create articles for this event
    for (const article of event.articles) {
      const source = createdSources[article.sourceIndex];
      if (source) {
        await prisma.newsArticle.create({
          data: {
            sourceId: source.id,
            eventId: createdEvent.id,
            title: article.title,
            url: `https://${sources[article.sourceIndex].domain}/article/${Date.now()}`,
            summary: article.summary,
            publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }
  console.log(`Created ${events.length} news events with articles`);

  // Create sample users
  const users = [];
  const userNames = ['NewsEnthusiast', 'PoliticalWatcher', 'TechGuru', 'HealthAdvocate', 'ScienceFan'];

  for (const name of userNames) {
    const alienId = AlienAuthService.generateMockAlienId();
    const user = await prisma.user.create({
      data: {
        alienId,
        displayName: name,
        bio: `Just a regular human interested in ${name.toLowerCase().replace(/([A-Z])/g, ' $1').trim()}.`,
        karma: Math.floor(Math.random() * 500),
        isVerified: true,
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} sample users`);

  // Create sample comments on the first event
  const firstEvent = await prisma.newsEvent.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (firstEvent && users.length > 0) {
    const comments = [
      { content: 'This is a historic moment for climate policy. Finally, world leaders are taking this seriously.', authorIndex: 0 },
      { content: 'I hope these commitments actually translate into action. We have seen too many empty promises.', authorIndex: 1 },
      { content: 'The funding for developing nations is crucial. Climate change affects everyone, but not equally.', authorIndex: 2 },
      { content: 'As someone who works in renewable energy, this gives me hope for the future of our industry.', authorIndex: 3 },
    ];

    const createdComments = [];
    for (const comment of comments) {
      const created = await prisma.comment.create({
        data: {
          eventId: firstEvent.id,
          authorId: users[comment.authorIndex].id,
          content: comment.content,
          upvotes: Math.floor(Math.random() * 20),
          downvotes: Math.floor(Math.random() * 5),
        },
      });
      created.score = created.upvotes - created.downvotes;
      await prisma.comment.update({
        where: { id: created.id },
        data: { score: created.score },
      });
      createdComments.push(created);
    }

    // Add some replies
    if (createdComments.length > 0) {
      await prisma.comment.create({
        data: {
          eventId: firstEvent.id,
          authorId: users[4].id,
          parentId: createdComments[0].id,
          content: 'Agreed! The scale of cooperation here is unprecedented.',
          depth: 1,
          upvotes: 5,
          downvotes: 0,
          score: 5,
        },
      });

      await prisma.comment.create({
        data: {
          eventId: firstEvent.id,
          authorId: users[0].id,
          parentId: createdComments[1].id,
          content: 'The accountability mechanisms in this agreement are actually quite robust compared to previous ones.',
          depth: 1,
          upvotes: 8,
          downvotes: 1,
          score: 7,
        },
      });
    }

    // Update comment count
    const commentCount = await prisma.comment.count({
      where: { eventId: firstEvent.id },
    });
    await prisma.newsEvent.update({
      where: { id: firstEvent.id },
      data: { commentCount },
    });

    console.log(`Created ${commentCount} sample comments`);
  }

  console.log('Database seeding completed!');
}

seed()
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
