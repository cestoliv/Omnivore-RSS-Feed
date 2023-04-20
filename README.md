
# Omnivore → RSS Feed

A very basic project to transform your Omnivore Inbox into an RSS feed, to read your articles from an RSS news application, or, in my case, with Koreader's news reader (on e-reader).
## Usage

Install dependencies

```bash
npm i
```

Create a `.env` file (make sure to replace at least the values between <>)

```env
PORT=3000
OMNIVORE_AUTH_COOKIE=xxx
```

**Run the program!**

```bash
npm run start
```

You can access your feed at: `http://localhost:3000/feed`

## 🤝 Contributing

Contributions, issues, and feature requests are very welcome!


## License

[MIT](https://choosealicense.com/licenses/mit/)
