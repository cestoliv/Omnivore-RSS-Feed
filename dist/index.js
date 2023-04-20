"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const graphql_request_1 = require("graphql-request");
const mime = require("mime");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT;
const endpoint = 'https://api-prod.omnivore.app/api/graphql';
const omnivore_auth_cookie = process.env.OMNIVORE_AUTH_COOKIE;
const getArticlesQuery = (0, graphql_request_1.gql) `
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
const graphQLClient = new graphql_request_1.GraphQLClient(endpoint, {
    headers: {
        cookie: `auth=${omnivore_auth_cookie}`,
    },
});
const getArticles = () => __awaiter(void 0, void 0, void 0, function* () {
    let after = '';
    let articles = [];
    while (true) {
        const data = yield graphQLClient.request(getArticlesQuery, {
            after,
            query: '',
            first: 10,
            includeContent: true,
            format: 'html',
        });
        articles = articles.concat(data.search.edges);
        if (data.search.pageInfo.hasNextPage) {
            after = data.search.pageInfo.endCursor;
        }
        else {
            break;
        }
    }
    return articles;
});
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const articles = yield getArticles();
    res.send(articles[0]['node']['content']);
}));
app.get('/feed', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const reqUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const articles = yield getArticles();
    let items = '';
    let i = 0;
    for (const article of articles) {
        // if (i++ >= 3) {
        // break;
        // }
        // i++;
        const node = article['node'];
        const author = node['author'] ? `<author>author@omnivore.app (${node['author']})</author>` : '';
        // Prevent not well-formed XML error by removing invalid characters
        const title = node['title'].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // replace & with &amp, but not &amp;
            .replace(/&(?!(amp;|lt;|gt;|apos;|quot;))/g, '&amp;');
        const content = node['content'].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // replace & with &amp, but not &amp;
            .replace(/&(?!(amp;|lt;|gt;|apos;|quot;))/g, '&amp;');
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
    const feed = `<?xml version="1.0" encoding="UTF-8"?>` +
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
    res.send(feed);
}));
app.listen(port, () => {
    console.log(`⚡️ running at http://localhost:${port}`);
});
