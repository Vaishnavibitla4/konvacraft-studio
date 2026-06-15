import postcss from "postcss";
import autoprefixer from "autoprefixer";

export async function processCSS(css) {
  const result = await postcss([autoprefixer()]).process(css, {
    from: undefined,
  });

  return result.css;
}
