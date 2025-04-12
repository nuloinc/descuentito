import React, { FC, ReactNode } from 'react';
import { PostHogProvider } from 'posthog-js/react';

interface PostHogProviderWrapperProps {
  children: ReactNode;
}

const PostHogProviderWrapper: FC<PostHogProviderWrapperProps> = ({ children }) => {
  return (
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: 'https://us.i.posthog.com',
      }}
    >
      {children}
    </PostHogProvider>
  );
};

export default PostHogProviderWrapper;
