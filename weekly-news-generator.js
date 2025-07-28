const fetch = require('node-fetch');
const xml2js = require('xml2js');

// Configuration
const WORDPRESS_URL = process.env.WORDPRESS_URL || 'https://toddoneill.com';
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;
const POST_CATEGORY = process.env.POST_CATEGORY || 'Media Updates';

// RSS Feeds from your OPML file
const RSS_FEEDS = [
  { title: 'UXmatters', url: 'http://www.uxmatters.com/index.xml', category: 'media-survey' },
  { title: 'Stories by UX Collective Editors on Medium', url: 'https://medium.com/feed/@uxdesigncc', category: 'media-survey' },
  { title: 'Boxes and Arrows', url: 'http://boxesandarrows.com/feed/', category: 'media-survey' },
  { title: 'Studio by UXPin', url: 'http://blog.uxpin.com/feed/', category: 'media-survey' },
  { title: 'UX Planet - Medium', url: 'https://uxplanet.org/feed', category: 'media-survey' },
  { title: 'NN/g latest articles and announcements', url: 'https://www.nngroup.com/feed/rss/', category: 'media-survey' },
  { title: 'Konigi', url: 'http://feeds2.feedburner.com/konigi', category: 'media-survey' },
  { title: 'User Experience on Smashing Magazine — For Web Designers And Developers', url: 'https://www.smashingmagazine.com/categories/user-experience/index.xml', category: 'media-survey' },
  { title: 'Eleganthack', url: 'http://www.eleganthack.com/?feed=rss2', category: 'media-survey' },
  { title: 'Userbrain Blog', url: 'https://userbrain.net/blog/feed', category: 'media-survey' },
  { title: 'JUX', url: 'http://uxpajournal.org/feed/', category: 'media-survey' },
  { title: 'Jakob Nielsen on UX', url: 'https://jakobnielsenphd.substack.com/feed', category: 'media-survey' },
  { title: 'UsabilityGeek - Usability & User Experience Blog', url: 'http://feeds.feedburner.com/UsabilityGeek', category: 'media-survey' },
  { title: 'UX Movement', url: 'http://feeds.feedburner.com/uxmovement', category: 'media-survey' },
  { title: 'UX Daily - User Experience Daily', url: 'http://www.interaction-design.org/rss/site_news.xml', category: 'media-survey' },
  { title: 'Interaction Design Association – IxDA', url: 'http://www.ixda.org/rss/', category: 'media-survey' },
  { title: 'A List Apart: The Full Feed', url: 'http://www.alistapart.com/rss.xml', category: 'media-survey' },
  { title: 'User Experience', url: 'http://www.usabilityprofessionals.org/uxmagazine/feed/', category: 'media-survey' },
  { title: 'UX Collective - Medium', url: 'https://uxdesign.cc/feed', category: 'media-survey' },
  { title: 'Jeffrey Zeldman Presents', url: 'http://www.zeldman.com/feed/zeldman.xml', category: 'media-survey' }
];

const courses = {
  'digital-media-law': {
    name: 'Digital Media Law',
    keywords: ['copyright', 'fair use', 'DMCA', 'platform liability', 'content moderation', 'free speech']
  },
  'professional-practice': {
    name: 'Professional Practice', 
    keywords: ['journalism career', 'creator economy', 'influencer marketing', 'brand partnerships']
  },
  'media-survey': {
    name: 'Media Survey',
    keywords: ['streaming wars', 'social media trends', 'AI content creation', 'video game industry']
  }
};

async function fetchRSSFeed(feedUrl) {
  try {
    const response = await fetch(feedUrl);
    const xmlText = await response.text();
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlText);
    
    const items = result.rss?.channel?.[0]?.item || result.feed?.entry || [];
    
    return items.slice(0, 5).map(item => ({
      title: item.title?.[0]?._ || item.title?.[0] || 'No title',
      summary: (item.description?.[0] || item.summary?.[0] || '').replace(/<[^>]*>/g, '').substring(0, 300) + '...',
      url: item.link?.[0]?.$ ? item.link[0].$.href : item.link?.[0] || '',
      date: new Date(item.pubDate?.[0] || item.published?.[0] || Date.now()).toISOString(),
      source: feedUrl
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS feed ${feedUrl}:`, error);
    return [];
  }
}

function categorizeArticle(article) {
  const articleText = (article.title + ' ' + article.summary).toLowerCase();
  
  let bestMatch = 'media-survey';
  let highestScore = 0;
  
  Object.entries(courses).forEach(([courseKey, course]) => {
    const score = course.keywords.reduce((acc, keyword) => {
      const matches = (articleText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      return acc + matches;
    }, 0);
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = courseKey;
    }
  });
  
  return { ...article, course: bestMatch };
}

async function generateWeeklyPost() {
  console.log('Fetching articles from RSS feeds...');
  
  const allArticles = [];
  
  for (const feed of RSS_FEEDS) {
    const articles = await fetchRSSFeed(feed.url);
    const categorizedArticles = articles.map(article => categorizeArticle({
      ...article,
      source: feed.title
    }));
    allArticles.push(...categorizedArticles);
    
    // Delay to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Filter to recent articles
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(article => 
    new Date(article.date) > weekAgo
  );
  
  // Generate HTML
  let postHTML = `<h1>Weekly Media Update - ${new Date().toLocaleDateString()}</h1>\n\n`;
  postHTML += `<p><em>Curated news and insights for MTSU Digital Media students</em></p>\n\n`;
  
  Object.keys(courses).forEach(courseKey => {
    const courseArticles = recentArticles.filter(article => article.course === courseKey);
    if (courseArticles.length > 0) {
      const course = courses[courseKey];
      
      postHTML += `<h2>${course.name}</h2>\n\n`;
      
      courseArticles.slice(0, 5).forEach(article => {
        postHTML += `<h3><a href="${article.url}" target="_blank">${article.title}</a></h3>\n`;
        postHTML += `<p><strong>Source:</strong> ${article.source} | <strong>Date:</strong> ${new Date(article.date).toLocaleDateString()}</p>\n`;
        postHTML += `<p>${article.summary}</p>\n`;
        postHTML += `<hr>\n\n`;
      });
    }
  });
  
  return postHTML;
}

async function postToWordPress(content) {
  const postTitle = `Weekly Media Update - ${new Date().toLocaleDateString()}`;
  
  const postData = {
    title: postTitle,
    content: content,
    status: 'publish',
    categories: [POST_CATEGORY]
  };
  
  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
  
  const response = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(postData)
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log(`Successfully posted to WordPress! Post ID: ${result.id}`);
    return result;
  } else {
    throw new Error(`WordPress API error: ${response.status}`);
  }
}

async function main() {
  try {
    console.log('Starting weekly news generation...');
    const content = await generateWeeklyPost();
    
    if (WORDPRESS_USERNAME && WORDPRESS_PASSWORD) {
      await postToWordPress(content);
      console.log('Weekly update posted successfully!');
    } else {
      console.log('WordPress credentials not provided, content generated only:');
      console.log(content);
    }
  } catch (error) {
    console.error('Error generating weekly update:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateWeeklyPost, postToWordPress };
