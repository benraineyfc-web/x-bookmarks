import { Box, useColorModeValue } from "@chakra-ui/react";

export default function Card({ children, ...rest }) {
  const bg = useColorModeValue("white", "navy.800");
  return (
    <Box
      bg={bg}
      borderRadius="16px"
      p="18px"
      border="1px solid"
      borderColor={useColorModeValue("gray.100", "whiteAlpha.100")}
      boxShadow="0px 1px 3px rgba(0, 0, 0, 0.04)"
      {...rest}
    >
      {children}
    </Box>
  );
}
