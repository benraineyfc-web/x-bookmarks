import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  colors: {
    brand: {
      50: "#EFF4FB",
      100: "#D6E4F9",
      200: "#B0C7F0",
      300: "#7FA1E3",
      400: "#4A7BD4",
      500: "#2B6CB0",
      600: "#2256A0",
      700: "#1A4178",
      800: "#132F56",
      900: "#0B1D38",
    },
    secondaryGray: {
      100: "#F0F2F5",
      200: "#E8EAED",
      300: "#F7F8FA",
      400: "#E9EBF0",
      500: "#8F9BBA",
      600: "#A3AED0",
      700: "#707EAE",
      800: "#707EAE",
      900: "#1B2559",
    },
    navy: {
      50: "#d0dcfb",
      100: "#aac0fe",
      200: "#a3b9f8",
      300: "#728fea",
      400: "#3652ba",
      500: "#1b3bbb",
      600: "#24388a",
      700: "#1B254B",
      800: "#111c44",
      900: "#0b1437",
    },
  },
  fonts: {
    heading: `'DM Sans', sans-serif`,
    body: `'DM Sans', sans-serif`,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: props.colorMode === "dark" ? "navy.900" : "#F9FAFB",
        fontFamily: "'DM Sans', sans-serif",
      },
      "*::placeholder": {
        color: props.colorMode === "dark" ? "whiteAlpha.400" : "secondaryGray.600",
      },
    }),
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "16px",
        fontWeight: "500",
      },
      variants: {
        brand: (props) => ({
          bg: props.colorMode === "dark" ? "brand.400" : "brand.500",
          color: "white",
          _hover: {
            bg: props.colorMode === "dark" ? "brand.300" : "brand.600",
          },
        }),
        outline: () => ({
          borderRadius: "16px",
        }),
      },
    },
  },
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
});

export default theme;
