import axios from "axios";

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export const searchImages = async (query) => {
  try {
    const requests = [];

    for (let page = 1; page <= 10; page++) {
      requests.push(
        axios.get("https://api.unsplash.com/search/photos", {
          params: {
            query,
            per_page: 10,
            page,
          },
          headers: {
            Authorization: `Client-ID ${ACCESS_KEY}`,
          },
        }),
      );
    }

    const responses = await Promise.all(requests);

    const merged = responses.flatMap((res) => res.data.results);

    return merged;
  } catch (error) {
    console.error(error);

    return [];
  }
};
