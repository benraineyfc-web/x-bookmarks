import { Box, useColorModeValue } from "@chakra-ui/react";

export default function Card({ children, ...rest }) {
  const bg = useColorModeValue("white", "navy.800");
  return (
    <Box
      bg={bg}
      borderRadius="20px"
      p="20px"
      boxShadow="0px 3.5px 5.5px rgba(0, 0, 0, 0.02)"
      {...rest}
    >
      {children}
    </Box>
  );
}
