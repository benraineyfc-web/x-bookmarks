import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  colors: {
    brand: {
      50: "#E9E3FF",
      100: "#C0B8FE",
      200: "#A195FD",
      300: "#8171FC",
      400: "#7551FF",
      500: "#422AFB",
      600: "#3311DB",
      700: "#2111A5",
      800: "#190793",
      900: "#11047A",
    },
    secondaryGray: {
      100: "#E0E5F2",
      200: "#E1E9F8",
      300: "#F4F7FE",
      400: "#E9EDF7",
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
        bg: props.colorMode === "dark" ? "navy.900" : "secondaryGray.300",
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
