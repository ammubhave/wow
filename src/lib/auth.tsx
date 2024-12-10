import { useKindeAuth } from "@kinde-oss/kinde-auth-react";

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
): React.FC<P> {
  const WithLoading: React.FC<P> = (props: P) => {
    const { isLoading, isAuthenticated, ..._auth } = useKindeAuth();

    return <WrappedComponent {...(props as P)} />;
  };

  return WithLoading;
}
