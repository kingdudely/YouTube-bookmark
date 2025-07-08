javascript:(function main(document) { // with(){} my beloved 💔
    const commentsApi = "https://www.googleapis.com/youtube/v3/commentThreads";
    const apiKey = "AIzaSyAfZTjnRADIeEjoNVZgxMZtD706by1wOmc"; // Ain't mine
    const query = 'a[href*="youtube.com"], a[href*="youtu.be"]';

    function getID(url) {
        const { pathname, hostname, searchParams, href } = url;
        let id;

        try {
            const path = pathname.split("/").filter(Boolean);

            if (hostname.includes("youtube.com")) {
                if (["shorts", "embed"].includes(path[0])) {
                    id = path[1];
                } else if (path[0] === "watch") {
                    id = searchParams.get("v");
                }
            } else if (hostname.includes("youtu.be")) {
                id = path[0];
            }
        } catch {
            id = href?.match(/^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?/]*[^\/#&?])/)?.[1]
        }

        return id;
    }

    function getURL(link) {
        try {
            const url = new URL(link);
            const { searchParams } = url;

            const id = getID(url);

            if (id != undefined) {
                const time = searchParams.get("t");
                if (time != undefined) {
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

    function changeURL(element) {
		const url = element.href;
        const newURL = getURL(url);

        if (newURL != undefined) {
            const { href, id } = newURL;
            
            element.href = "";
            element.addEventListener("click", async input => {
                input.preventDefault();
                
                const page = window.open("", "_blank"); // target
                const pagedoc = page?.document;

                if (pagedoc != undefined) {
                    const pagebody = pagedoc.body;
                    pagedoc.title = "YouTube";

                    const info = await (await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url))).json();
					
                    const button = pagedoc.createElement("button");
                    button.textContent = "View Thumbnail";
                    button.addEventListener("click", () => {
						window.open(info.thumbnail_url, null, `width=${info.thumbnail_width}, height=${info.thumbnail_height}`);
					});

                    const iframeContainer = pagedoc.createElement("div");
                    iframeContainer.width = 300;
                    iframeContainer.height = 300;
                    iframeContainer.style.overflow = "auto";
                    iframeContainer.style.resize = "both";
                    
                    const iframe = pagedoc.createElement("iframe");
                    iframe.src = href;
                    // iframe.width/height
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    iframe.allowFullscreen = true;
                    iframeContainer.appendChild(iframe);

					let nextPageToken, debounce;
                    async function fetchComments() {
						if (debounce) {
							return;
						};
		
						debounce = true;
						
						let commentsUrl = commentsApi + `?part=snippet,replies&videoId=${id}&key=` + apiKey;
						
						if (nextPageToken != undefined) {
							commentsUrl += `&pageToken=${nextPageToken}`;
						};
		
						const comments = await (await fetch(commentsUrl)).json();

						nextPageToken = comments.nextPageToken;

						// End of comments
						if (!nextPageToken) {
					        debounce = true;
					    } else {
					        debounce = false;
					    }
		
						return comments;
					}

                    const commentContainer = renderComments(await fetchComments(), pagedoc.createElement("div"));
                    
                    page.addEventListener("scroll", async () => {
                        if (page.innerHeight + page.pageYOffset >= pagebody.offsetHeight - 500) {
                            renderComments(await fetchComments(), commentContainer);
                        };
                    });
                    
                    pagebody.append(
                        button,
                        pagedoc.createElement("br"),
                        iframeContainer,
                        pagedoc.createElement("br"),
                        commentContainer
                    );
                    
                    main(pagedoc);
                }
            });
        }
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
		if (comments == undefined || container == undefined) {
			return;
		};

        comments = simplifyComments(comments); // Simplify the format for readability I guess
        const document = container.ownerDocument;

        // Makes new comment div
        function newComment({ pfp, author, likes, text }, isReply = false) { // Supposed to be false, but I made it true for replies.map(newComment)
            const size = isReply ? 24 : 32;
            const div = document.createElement("div");
            
            div.appendChild(Object.assign(document.createElement("img"), {
                src: pfp,
                alt: author + "'s profile picture",
                width: size,
                height: size,
            })).style.verticalAlign = "middle";
            
            div.appendChild(document.createElement("b")).textContent = ` ${author} `;
            div.appendChild(document.createElement("span")).textContent = ` | 👍 ${likes} `;
            div.appendChild(document.createElement("p")).innerHTML = text;
            
            return div;
        }

        // Comments
        comments.forEach(comment => {
            const parentComment = newComment(comment);
            
            const replies = comment.replies;
            const length = replies.length;

            if (length != undefined) {
                const details = document.createElement("details");
                details.appendChild(document.createElement("summary")).textContent = length + (length === 1 ? " reply" : " replies");
                details.append(...replies.map(reply => newComment(reply, true)));
                parentComment.appendChild(details);
            };
            
            container.append(parentComment, document.createElement("hr"));
        });

        return container;
    };

    document.querySelectorAll(query).forEach(changeURL);
	
    document.querySelectorAll("iframe").forEach(iframe => {
        if (iframe.contentDocument != undefined) {
            main(iframe.contentDocument);
        };
    });

    const observer = new MutationObserver(mutations => mutations.forEach(mutation => {
        for (const node of mutation?.addedNodes) {
            if (node?.nodeType === 1) {
                if (node?.matches(query)) {
                    changeURL(node);
                }
                
                node?.querySelectorAll(query)?.forEach(changeURL);
            };
         }
    }));

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})(document);
