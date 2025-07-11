javascript:(function () {
	const commentsApi = "https://www.googleapis.com/youtube/v3/commentThreads";
	const apiKey = "AIzaSyAfZTjnRADIeEjoNVZgxMZtD706by1wOmc"; // Ain't mine
	const query = 'a[href*="youtube.com"], a[href*="youtu.be"]';

	function getID(url) {
		const { pathname, hostname, searchParams, href } = url;
		let id;

		try {
			const path = pathname.split("/").filter(Boolean);
			const firstPath = path[0];

			if (hostname.includes("youtube.com")) {
				if (firstPath === "shorts" || firstPath === "embed") {
					id = path[1];
				} else if (firstPath === "watch") {
					id = searchParams.get("v");
				}
			} else if (hostname.includes("youtu.be")) {
				id = firstPath;
			}
		} catch {
			id = href?.match(/^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?/]*[^\/#&?])/)?.[1];
		}

		return id;
	}

	function getURL(link) {
		try {
			const url = new URL(link);
			const { searchParams } = url;

			const id = getID(url);

			if (id != null) {
				const time = searchParams.get("t");

				if (time != null) {
					const seconds = +time || String(time).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)?.map((v, i, a) => (+v || 0) * (60 ** ((a.length - 1) - i))).reduce((a, b) => a + b);
					searchParams.set("start", seconds);
				}

				searchParams.delete("t");
				searchParams.delete("v");

				url.id = id;
				url.hostname = "www.youtube-nocookie.com";
				url.pathname = "/embed/" + id;
				url.protocol = "https:";

				return url;
			}
		} catch {}
	};

	async function open(url) {
		const newURL = getURL(url);

		if (!(newURL instanceof URL)) {
			return;
		};

		const { href, id } = newURL;

		const page = window.open("", "_blank");
		const pagedoc = page?.document;

		if (pagedoc != null) {
			const pagebody = pagedoc.body;
			pagedoc.title = "YouTube";

			const info = await (await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url))).json();

			const button = pagedoc.createElement("button");
			button.textContent = "View Thumbnail";
			button.addEventListener("click", () => window.open(info?.thumbnail_url, null, `width=${info.thumbnail_width}, height=${info.thumbnail_height}`));

			const iframeContainer = pagedoc.createElement("div");
			iframeContainer.width = 300;
			iframeContainer.height = 300;
			Object.assign(iframeContainer.style, {
				overflow: "auto",
				resize: "both",
			});

			const iframe = pagedoc.createElement("iframe");
			iframe.src = href;
			iframe.allowFullscreen = true;
			Object.assign(iframe.style, {
				width: "100%",
				height: "100%",
			});

			iframeContainer.appendChild(iframe);

			let nextPageToken, debounce;
			async function fetchComments() {
				if (debounce) {
					return;
				};

				debounce = true;

				let commentsUrl = commentsApi + `?part=snippet,replies&videoId=${id}&key=` + apiKey;

				if (nextPageToken != null) {
					commentsUrl += `&pageToken=${nextPageToken}`;
				};

				const comments = await (await fetch(commentsUrl)).json();

				if (nextPageToken === comments?.nextPageToken) {
					debounce = true;
					return;
				};

				nextPageToken = comments?.nextPageToken;
				debounce = false;

				return comments;
			}

			const commentContainer = pagedoc.createElement("div");
			pagebody.append(
				button,
				pagedoc.createElement("br"),
				iframeContainer,
				pagedoc.createElement("br"),
				commentContainer
			);

			renderComments(await fetchComments(), commentContainer);

			page.addEventListener("scroll", async function () {
				if (page.innerHeight + page.pageYOffset >= pagebody.offsetHeight - 500) {
					renderComments(await fetchComments(), commentContainer);
				};
			});
		};
	};

	const simplifyComments = comments =>
		comments.items.map(({ snippet: { topLevelComment: { snippet: s } }, replies }) => ({
			author: s.authorDisplayName,
			pfp: s.authorProfileImageUrl,
			likes: s.likeCount,
			text: s.textDisplay,
			replies: replies?.comments?.map(({ snippet: r }) => ({
				author: r.authorDisplayName,
				pfp: r.authorProfileImageUrl,
				likes: r.likeCount,
				text: r.textDisplay
			})) || []
		}));

	function renderComments(comments, container) {
		if (comments == null || container == null) {
			return;
		};

		comments = simplifyComments(comments);
		const document = container.ownerDocument;

		function newComment({ pfp, author, likes, text }, isReply = false) {
			const size = isReply ? 24 : 32;
			const div = document.createElement("div");

			const profilePicture = document.createElement("img");
			profilePicture.src = pfp;
			profilePicture.width = size;
			profilePicture.height = size;

			const name = document.createElement("b");
			name.textContent = ` ${author} `;

			const likeAmount = document.createElement("span")
			likeAmount.textContent = ` | 👍 ${likes} `

			const content = document.createElement("p")
			content.innerHTML = text;

			div.append(profilePicture, name, likeAmount, content);

			return div;
		}

		for (const comment of comments) {
			const parentComment = newComment(comment);

			const replies = comment?.replies;
			const length = replies?.length;

			if (length != null) {
				const replyContainer = document.createElement("details");

				const replyAmount = document.createElement("summary")
				replyAmount.textContent = length + (length <= 1 ? " reply" : " replies");
				replyContainer.appendChild(replyAmount);

				for (const reply of replies) {
					replyContainer.appendChild(newComment(reply, true));
				};

				parentComment.appendChild(replyContainer);
			};

			container.append(parentComment, document.createElement("hr"));
		}

		return container;
	};

	open(prompt("Enter your YouTube video URL:"));
})();
