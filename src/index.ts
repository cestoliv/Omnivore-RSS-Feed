import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { GraphQLClient, gql } from 'graphql-request';
import mime = require('mime');

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

const endpoint = 'https://api-prod.omnivore.app/api/graphql';
const omnivore_auth_cookie = process.env.OMNIVORE_AUTH_COOKIE;

const getArticlesQuery = gql`
	query Search(
		$after: String
		$first: Int
		$query: String
		$includeContent: Boolean
		$format: String
	) {
		search(
			after: $after
			first: $first
			query: $query
			includeContent: $includeContent
			format: $format
		) {
			... on SearchSuccess {
				edges {
					node {
						id
						title
						slug
						content
						url
						createdAt
						image
						author
					}
				}
				pageInfo {
					hasNextPage
					endCursor
					totalCount
				}
			}
			... on SearchError {
				errorCodes
			}
		}
	}
`;

const graphQLClient = new GraphQLClient(endpoint, {
	headers: {
		cookie: `auth=${omnivore_auth_cookie}`,
	},
});

const getArticles = async () => {
	let after = '';
	let articles: any = [];

	while (true) {
		const data = await graphQLClient.request(getArticlesQuery, {
			after,
			query: '',
			first: 10,
			includeContent: true,
			format: 'html',
		}) as any;

		articles = articles.concat(data.search.edges);

		if (data.search.pageInfo.hasNextPage) {
			after = data.search.pageInfo.endCursor;
		} else {
			break;
		}
	}

	return articles;
};

app.get('/', async (req: Request, res: Response) => {
	const articles = await getArticles();
	res.send(articles[0]['node']['content']);
});

app.get('/feed', async (req: Request, res: Response) => {
	const reqUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

	const articles = await getArticles();

	let items = '';
	let i = 0;
	for (const article of articles) {
		const node = article['node'];

		const author = node['author'] ? `<author>author@omnivore.app (${node['author']})</author>` : '';

		// Prevent not well-formed XML error by removing invalid characters
		const title = node['title'].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
			// replace & with &amp, but not &amp;
			.replace(/&(?!(amp;|lt;|gt;|apos;|quot;))/g, '&amp;')

		const content = node['content'].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
			// replace & with &amp, but not &amp;
			.replace(/&(?!(amp;|lt;|gt;|apos;|quot;))/g, '&amp;')

		// Get image mime type (remove ?x=y from url)
		let image_type = null;
		if (node['image']) {
			const image_url = node['image'].split('?')[0];
			image_type = mime.getType(image_url);
		}

		items +=
			`<item>` +
				`<title>${title}</title>` +
				`<link>${node['url']}</link>` +
				`<description><![CDATA[${content}]]></description>` +
				`<pubDate>${new Date(node['createdAt']).toUTCString()}</pubDate>` +
				`<guid isPermaLink="false">${node['id']}</guid>` +
				author +
				(node['image'] ? `<enclosure url="${node['image']}" type="${image_type}" />` : '') +
			`</item>`;
	}

	const feed =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">` +
		`<channel>` +
			`<title>Omnivore</title>` +
			`<link>https://omnivore.app</link>` +
			`<description>Articles from Omnivore</description>` +
			`<atom:link href="${reqUrl}" rel="self" type="application/rss+xml" />` +
			items +
		`</channel>` +
		`</rss>`;

	res.set('Content-Type', 'text/xml');
	res.send(feed)
});

app.listen(port, () => {
	console.log(`⚡️ running at http://localhost:${port}`);
});
